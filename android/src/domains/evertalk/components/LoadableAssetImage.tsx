import type { ReactNode } from 'react';
import { Image, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { resolveAssetUri } from '../../../shared/assets';
import { useFirstLoadableImage } from '../hooks';

export interface LoadableAssetImageSize {
    width: number;
    height: number;
}

export interface LoadableAssetImageProps {
    candidates: string[];
    alt: string;
    style?: StyleProp<ImageStyle>;
    resizeMode?: ImageResizeMode;
    fallback: ReactNode;
    onLoad?: (size: LoadableAssetImageSize) => void;
}

export function LoadableAssetImage({ candidates, alt, style, resizeMode = 'cover', fallback, onLoad }: LoadableAssetImageProps) {
    const [src, useNextImage] = useFirstLoadableImage(candidates);
    if (!src) {
        return <>{fallback}</>;
    }
    return (
        <Image
            style={style}
            source={{ uri: resolveAssetUri(src) }}
            resizeMode={resizeMode}
            accessibilityLabel={alt}
            accessibilityIgnoresInvertColors={true}
            onError={useNextImage}
            onLoad={(event) => onLoad?.({ width: event.nativeEvent.source.width, height: event.nativeEvent.source.height })}
        />
    );
}
