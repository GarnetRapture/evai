import { codegenNativeComponent, type CodegenTypes, type HostComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
    source: string;
    tileWidth: CodegenTypes.Float;
    tileHeight: CodegenTypes.Float;
}

export default codegenNativeComponent<NativeProps>('EvaiPatternView') as HostComponent<NativeProps>;
