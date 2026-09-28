import { useState } from 'react';
import { StatusBar } from 'react-native';
import type { AssetPreparationState } from './domains/assets/types';
import { AssetPreparationGate, EverTalkApp } from './domains/evertalk';

export default function App() {
    const [assetPreparation, setAssetPreparation] = useState<AssetPreparationState | null>(null);
    return (
        <>
            <StatusBar barStyle="light-content"/>
            {assetPreparation === null
                ? <AssetPreparationGate onReady={setAssetPreparation}/>
                : <EverTalkApp initialAssetPreparation={assetPreparation}/>}
        </>
    );
}
