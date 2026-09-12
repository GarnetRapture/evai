import { EverTalkApp } from './domains/evertalk';
import { MobileEverTalkApp } from './domains/evertalk/mobile/MobileEverTalkApp';
import { detectAppPlatform } from './shared/platform';

export default function App() {
    return detectAppPlatform() === 'android_app' ? <MobileEverTalkApp /> : <EverTalkApp />;
}
