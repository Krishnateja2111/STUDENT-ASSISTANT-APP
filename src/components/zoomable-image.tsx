import { Image } from 'expo-image';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

export interface ZoomableImageProps {
  uri: string;
  /** Height of the viewport the image sits in — needed to clamp panning so the image can't be dragged fully off-screen. */
  height: number;
}

/**
 * A pinch-to-zoom, pan-when-zoomed, double-tap-to-toggle image viewer.
 * Built on react-native-gesture-handler + react-native-reanimated (both
 * already app dependencies) rather than a new library — this is the same
 * pinch/pan/double-tap pattern most photo viewers use.
 */
export function ZoomableImage({ uri, height }: ZoomableImageProps) {
  const { width } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Keeps a zoomed image from being panned so far that it leaves the
  // viewport entirely — the max offset grows with how far past 1x the
  // current zoom is.
  const clamp = (value: number, extent: number) => Math.min(Math.max(value, -extent), extent);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return;
      const maxOffsetX = (width * (scale.value - 1)) / 2;
      const maxOffsetY = (height * (scale.value - 1)) / 2;
      translateX.value = clamp(savedTranslateX.value + e.translationX, maxOffsetX);
      translateY.value = clamp(savedTranslateY.value + e.translationY, maxOffsetY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      savedScale.value = next;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ width: '100%', height, overflow: 'hidden' }, animatedStyle]}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
