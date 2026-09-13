import { DomainError } from '../../../shared/errors';
import { settingsRepository } from '../../settings/repository';
import { CHROME_GEMMA4_FLAG_ID } from '../constants';
import { chromePromptModelVariant } from '../identity';
import { chromePromptVariantRequiresGemma4Flag, verifyChromePromptVariant } from './localState';

export async function assertChromePromptVariantActive(modelId: string): Promise<void> {
    const variant = chromePromptModelVariant(modelId);
    const general = await settingsRepository.readGeneral();
    if (verifyChromePromptVariant(variant, general.chrome_browser_model_state ?? null) === 'flag_mismatch') {
        throw new DomainError(
            'model_not_ready',
            `chrome_prompt_variant_flag_mismatch:${variant}:${CHROME_GEMMA4_FLAG_ID}=${chromePromptVariantRequiresGemma4Flag(variant) ? 'Enabled' : 'Default'}`,
        );
    }
}
