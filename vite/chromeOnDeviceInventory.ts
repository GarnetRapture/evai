import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  ChromeOnDeviceInventory,
  ChromeOnDeviceModelFileFormat,
  ChromeOnDeviceModelVariant,
} from '../src/shared/types/chromeOnDevice.ts'

interface BrowserDataRoot {
  browser: string
  path: string
}

interface LedgerEntry {
  assetId: string
  requestedVersion: string
  directoryKey: string
}

interface ComponentDirectory {
  path: string
  version: string
  baseModelName: string | null
  baseModelVersion: string | null
}

interface PromptFeatureConfig {
  defaultUseCase: string
  versionUseCases: Array<{ key: string; useCase: string }>
}

const PROMPT_FEATURE_CONFIG_TYPE = 'PromptApiFeatureConfig'
const LITERTLM_MAGIC = 'LITERTLM'
const WEBKIT_EPOCH_OFFSET_MS = 11_644_473_600_000n
const COMPONENT_MANIFEST_DEPTH = 3
const PRINTABLE_TEXT_PATTERN = /^[ -~ -￿\t\n\r]+$/u

function browserDataRoots(): BrowserDataRoot[] {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) return []
    return [
      { browser: 'Google Chrome', path: join(localAppData, 'Google', 'Chrome', 'User Data') },
      { browser: 'Google Chrome Beta', path: join(localAppData, 'Google', 'Chrome Beta', 'User Data') },
      { browser: 'Google Chrome Dev', path: join(localAppData, 'Google', 'Chrome Dev', 'User Data') },
      { browser: 'Google Chrome Canary', path: join(localAppData, 'Google', 'Chrome SxS', 'User Data') },
      { browser: 'Chromium', path: join(localAppData, 'Chromium', 'User Data') },
    ]
  }
  if (process.platform === 'darwin') {
    const support = join(homedir(), 'Library', 'Application Support')
    return [
      { browser: 'Google Chrome', path: join(support, 'Google', 'Chrome') },
      { browser: 'Google Chrome Beta', path: join(support, 'Google', 'Chrome Beta') },
      { browser: 'Google Chrome Canary', path: join(support, 'Google', 'Chrome Canary') },
      { browser: 'Chromium', path: join(support, 'Chromium') },
    ]
  }
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return [
    { browser: 'Google Chrome', path: join(configHome, 'google-chrome') },
    { browser: 'Google Chrome Beta', path: join(configHome, 'google-chrome-beta') },
    { browser: 'Google Chrome Dev', path: join(configHome, 'google-chrome-unstable') },
    { browser: 'Chromium', path: join(configHome, 'chromium') },
  ]
}

function readJsonObject(path: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function objectAt(value: unknown, ...keys: string[]): Record<string, unknown> | null {
  let current: unknown = value
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'object' && current !== null && !Array.isArray(current) ? current as Record<string, unknown> : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function webkitTimestampToIso(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) return null
  const milliseconds = BigInt(value) / 1000n - WEBKIT_EPOCH_OFFSET_MS
  return new Date(Number(milliseconds)).toISOString()
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; next: number } | null {
  let value = 0
  let shift = 0
  let position = offset
  while (position < bytes.length && shift < 49) {
    const byte = bytes[position]
    value += (byte & 0x7f) * 2 ** shift
    position += 1
    if ((byte & 0x80) === 0) return { value, next: position }
    shift += 7
  }
  return null
}

function decodeText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return PRINTABLE_TEXT_PATTERN.test(text) ? text : null
  } catch {
    return null
  }
}

function collectProtobufStrings(bytes: Uint8Array, output: string[]): boolean {
  let offset = 0
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset)
    if (!tag || tag.value === 0) return false
    offset = tag.next
    const wireType = tag.value % 8
    if (wireType === 0) {
      const varint = readVarint(bytes, offset)
      if (!varint) return false
      offset = varint.next
    } else if (wireType === 1) {
      offset += 8
    } else if (wireType === 5) {
      offset += 4
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset)
      if (!length || length.next + length.value > bytes.length) return false
      const payload = bytes.subarray(length.next, length.next + length.value)
      offset = length.next + length.value
      const nested: string[] = []
      if (collectProtobufStrings(payload, nested) && nested.length > 0) {
        output.push(...nested)
        continue
      }
      const text = decodeText(payload)
      if (text !== null) output.push(text)
    } else {
      return false
    }
    if (offset > bytes.length) return false
  }
  return true
}

function latestManifestDirectory(userDataPath: string): string | null {
  const root = join(userDataPath, 'OptimizationGuideModelsManifest')
  if (!existsSync(root)) return null
  const versions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'manifest.binarypb')))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const latest = versions.at(-1)
  return latest ? join(root, latest) : null
}

function promptFeatureConfig(strings: string[]): PromptFeatureConfig | null {
  const typeIndex = strings.findIndex((value) => value.endsWith(PROMPT_FEATURE_CONFIG_TYPE))
  if (typeIndex < 0 || typeIndex + 1 >= strings.length) return null
  const defaultUseCase = strings[typeIndex + 1]
  const versionUseCases: PromptFeatureConfig['versionUseCases'] = []
  for (let index = typeIndex + 2; index + 1 < strings.length && strings[index + 1].startsWith(defaultUseCase); index += 2) {
    versionUseCases.push({ key: strings[index], useCase: strings[index + 1] })
  }
  return { defaultUseCase, versionUseCases }
}

function relationMap(strings: string[], matches: (index: number) => boolean): Map<string, string[]> {
  const relations = new Map<string, string[]>()
  for (let index = 0; index + 1 < strings.length; index += 1) {
    if (!matches(index)) continue
    const targets = relations.get(strings[index]) ?? []
    if (!targets.includes(strings[index + 1])) targets.push(strings[index + 1])
    relations.set(strings[index], targets)
  }
  return relations
}

function componentDirectories(userDataPath: string): ComponentDirectory[] {
  const directories: ComponentDirectory[] = []
  const visit = (path: string, depth: number) => {
    let entries
    try {
      entries = readdirSync(path, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const child = join(path, entry.name)
      if (entry.isDirectory() && depth < COMPONENT_MANIFEST_DEPTH) {
        visit(child, depth + 1)
        continue
      }
      if (!entry.isFile() || entry.name !== 'manifest.json' || !existsSync(join(path, 'weights.bin'))) continue
      const manifest = readJsonObject(child)
      const baseModel = objectAt(manifest, 'BaseModelSpec')
      const version = stringValue(manifest?.version)
      if (!baseModel || !version) continue
      directories.push({
        path,
        version,
        baseModelName: stringValue(baseModel.name),
        baseModelVersion: stringValue(baseModel.version),
      })
    }
  }
  visit(userDataPath, 0)
  return directories
}

function weightsFormat(path: string): ChromeOnDeviceModelFileFormat {
  if (!existsSync(path)) return 'missing'
  const descriptor = openSync(path, 'r')
  try {
    const header = Buffer.alloc(LITERTLM_MAGIC.length)
    readSync(descriptor, header, 0, header.length, 0)
    return header.toString('latin1') === LITERTLM_MAGIC ? 'litertlm' : 'opaque'
  } finally {
    closeSync(descriptor)
  }
}

function readInventory(root: BrowserDataRoot): ChromeOnDeviceInventory | null {
  const localState = readJsonObject(join(root.path, 'Local State'))
  const optimizationGuide = objectAt(localState, 'optimization_guide')
  if (!optimizationGuide) return null
  const manifestDirectory = latestManifestDirectory(root.path)
  if (!manifestDirectory) return null
  const strings: string[] = []
  collectProtobufStrings(readFileSync(join(manifestDirectory, 'manifest.binarypb')), strings)
  const featureConfig = promptFeatureConfig(strings)
  if (!featureConfig) return null
  const modelComponents = relationMap(strings, (index) => strings[index].endsWith('_model') && strings[index + 1]?.endsWith('_component') === true && strings[index + 2] === 'weights.bin')
  const solutionModels = relationMap(strings, (index) => strings[index].endsWith('_solution') && strings[index + 1]?.endsWith('_model') === true && strings[index + 2] === 'manifest')
  const useCaseSolutions = relationMap(strings, (index) => strings[index].startsWith(featureConfig.defaultUseCase) && strings[index + 1]?.endsWith('_solution') === true)
  const ledger = new Map<string, LedgerEntry>()
  const ledgerRecords = objectAt(optimizationGuide, 'model_execution', 'manifest_asset_ledger') ?? {}
  for (const directoryKey of Object.keys(ledgerRecords)) {
    const record = objectAt(ledgerRecords, directoryKey)
    const assetId = stringValue(record?.asset_id)
    const requestedVersion = stringValue(record?.requested_version)
    if (assetId && requestedVersion) ledger.set(assetId, { assetId, requestedVersion, directoryKey })
  }
  const usage = objectAt(optimizationGuide, 'model_execution', 'last_usage_by_feature') ?? {}
  const directories = componentDirectories(root.path)
  const onDevice = objectAt(optimizationGuide, 'on_device')
  const useCases = [
    { useCase: featureConfig.defaultUseCase, key: null as string | null },
    ...featureConfig.versionUseCases.map((entry) => ({ useCase: entry.useCase, key: entry.key as string | null })),
  ]
  const variants: ChromeOnDeviceModelVariant[] = useCases.map(({ useCase, key }) => {
    const components = (useCaseSolutions.get(useCase) ?? [])
      .flatMap((solution) => solutionModels.get(solution) ?? [])
      .flatMap((model) => modelComponents.get(model) ?? [])
    const installedComponent = components.find((component) => ledger.has(component)) ?? components.at(0) ?? null
    const ledgerEntry = installedComponent ? ledger.get(installedComponent) ?? null : null
    const requestedVersion = ledgerEntry?.requestedVersion ?? null
    const directory = ledgerEntry
      ? directories.find((candidate) => candidate.version === ledgerEntry.requestedVersion && candidate.path.includes(ledgerEntry.directoryKey))
        ?? directories.find((candidate) => candidate.version === ledgerEntry.requestedVersion)
        ?? null
      : null
    const weightsPath = directory ? join(directory.path, 'weights.bin') : null
    return {
      use_case: useCase,
      model_version_key: key,
      component_asset_id: installedComponent,
      component_version: requestedVersion,
      installed: directory !== null,
      base_model_name: directory?.baseModelName ?? null,
      base_model_version: directory?.baseModelVersion ?? null,
      weights_path: weightsPath,
      weights_bytes: weightsPath && existsSync(weightsPath) ? statSync(weightsPath).size : null,
      weights_format: weightsPath ? weightsFormat(weightsPath) : 'missing',
      last_requested_at: webkitTimestampToIso(usage[useCase]),
    }
  })
  return {
    browser: root.browser,
    user_data_path: root.path,
    browser_version: stringValue(onDevice?.last_version),
    performance_class: numberValue(onDevice?.performance_class),
    vram_mb: numberValue(onDevice?.vram_mb),
    default_use_case: featureConfig.defaultUseCase,
    variants,
    read_at: new Date().toISOString(),
  }
}

export function readChromeOnDeviceInventory(browserVersion: string | null): ChromeOnDeviceInventory | null {
  const inventories = browserDataRoots()
    .filter((root) => existsSync(join(root.path, 'Local State')))
    .map(readInventory)
    .filter((inventory): inventory is ChromeOnDeviceInventory => inventory !== null)
  if (browserVersion) {
    const matched = inventories.find((inventory) => inventory.browser_version === browserVersion)
    if (matched) return matched
  }
  return inventories.at(0) ?? null
}
