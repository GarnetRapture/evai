import { codegenNativeComponent, type CodegenTypes, type HostComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
    source: string;
    paused: boolean;
    muted: boolean;
    loop: boolean;
    contain: boolean;
    onVideoReady?: CodegenTypes.DirectEventHandler<Readonly<{ duration: CodegenTypes.Double }>>;
    onVideoEnd?: CodegenTypes.DirectEventHandler<Readonly<{ completed: boolean }>>;
    onVideoError?: CodegenTypes.DirectEventHandler<Readonly<{ message: string }>>;
}

export default codegenNativeComponent<NativeProps>('EvaiVideoView') as HostComponent<NativeProps>;
