import { codegenNativeComponent, type CodegenTypes, type HostComponent, type ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
    shapes: string;
    viewBoxX: CodegenTypes.Float;
    viewBoxY: CodegenTypes.Float;
    viewBoxWidth: CodegenTypes.Float;
    viewBoxHeight: CodegenTypes.Float;
}

export default codegenNativeComponent<NativeProps>('EvaiVectorView') as HostComponent<NativeProps>;
