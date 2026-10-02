import type * as React from 'react';
import { codegenNativeCommands, codegenNativeComponent, type CodegenTypes, type HostComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
    source: string;
    paused: boolean;
    muted: boolean;
    loop: boolean;
    contain: boolean;
    onVideoReady?: CodegenTypes.DirectEventHandler<Readonly<{ duration: CodegenTypes.Double }>>;
    onVideoProgress?: CodegenTypes.DirectEventHandler<Readonly<{ position: CodegenTypes.Double; duration: CodegenTypes.Double }>>;
    onVideoEnd?: CodegenTypes.DirectEventHandler<Readonly<{ completed: boolean }>>;
    onVideoError?: CodegenTypes.DirectEventHandler<Readonly<{ message: string }>>;
}

type ComponentType = HostComponent<NativeProps>;

interface NativeCommands {
    seekTo: (viewRef: React.ElementRef<ComponentType>, seconds: CodegenTypes.Double) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
    supportedCommands: ['seekTo'],
});

export default codegenNativeComponent<NativeProps>('EvaiVideoView') as ComponentType;
