import { inspectDeviceEnvironment } from '../../../shared/platform';
import type { ChromeOnDeviceInventoryResponse } from '../../../shared/types/chromeOnDevice';
import type { ChromeOnDeviceInventoryState } from '../types';

const CHROME_ON_DEVICE_INVENTORY_ENDPOINT = '/__eversoul/chrome-on-device';

export async function readChromeOnDeviceInventory(): Promise<ChromeOnDeviceInventoryState> {
    if (!import.meta.env.DEV) {
        return { inventory: null, detail: 'chrome_on_device_inventory_requires_local_bridge' };
    }
    const environment = await inspectDeviceEnvironment();
    const query = new URLSearchParams({ browser_version: environment.browser.version });
    const response = await fetch(`${CHROME_ON_DEVICE_INVENTORY_ENDPOINT}?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) {
        return { inventory: null, detail: `chrome_on_device_inventory_http_${response.status}` };
    }
    const body = await response.json() as ChromeOnDeviceInventoryResponse;
    return { inventory: body.inventory, detail: body.detail };
}
