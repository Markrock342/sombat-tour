import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, PanResponder, Animated, ActivityIndicator, findNodeHandle, Platform } from 'react-native';
import { RefreshControl as NativeRefreshControl } from 'react-native';

/**
 * Pull must go farther before refresh triggers — less accidental refresh while scrolling.
 * Tuned for dashboard “งานประจำวัน” lists on mobile PWA.
 */
const PULL_TRIGGER_PX = 110;
const PULL_CAPTURE_DY = 28;
const PULL_CAPTURE_VY_RATIO = 3.2;

const arrowIcon =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAKqNIzIAAAAJcEhZcwAADdcAAA3XAUIom3gAAAAHdElNRQfgCQYHLCTylhV1AAAAjklEQVQ4y2P8z0AaYCJRPX4NsyNWM5Ok4R/n+/noWhjx+2F20n8HwcTQv0T7IXUe4wFUWwh6Gl0LEaGEqoWoYEXWQmQ8ILQwEh/TkBBjme3HIESkjn+Mv9/vJjlpkOwkom2AxTmRGhBJhCgNyCmKCA2oCZCgBvT0ykSacgIaZiaiKydoA7pykiKOSE+jAwADZUnJjMWwUQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNi0wOS0wNlQwNzo0NDozNiswMjowMAZN3oQAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTYtMDktMDZUMDc6NDQ6MzYrMDI6MDB3EGY4AAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAABJRU5ErkJggg==';

function SoftWebRefreshControl({
  refreshing,
  tintColor,
  colors,
  style,
  progressViewOffset,
  children,
  size,
  title,
  titleColor,
  onRefresh,
  enabled,
}) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const containerRef = useRef();
  const pullPosReachedState = useRef(0);
  const pullPosReachedAnimated = useRef(new Animated.Value(0));
  const pullDownSwipeMargin = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(pullDownSwipeMargin.current, {
      toValue: refreshing ? 50 : 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
    if (refreshing) {
      pullPosReachedState.current = 0;
      pullPosReachedAnimated.current.setValue(0);
    }
  }, [refreshing]);

  const onPanResponderFinish = useCallback(() => {
    if (pullPosReachedState.current && onRefreshRef.current) {
      onRefreshRef.current();
    }
    if (!pullPosReachedState.current) {
      Animated.timing(pullDownSwipeMargin.current, {
        toValue: 0,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!containerRef.current) return false;
        const containerDOM = findNodeHandle(containerRef.current);
        if (!containerDOM) return false;
        // Need a deliberate downward pull while already scrolled to top
        return (
          containerDOM.children[0].scrollTop === 0 &&
          gestureState.dy > PULL_CAPTURE_DY &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2.5 &&
          Math.abs(gestureState.vy) > Math.abs(gestureState.vx) * PULL_CAPTURE_VY_RATIO
        );
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (enabledRef.current !== undefined && !enabledRef.current) return;

        const adjustedDy = gestureState.dy <= 0 ? 0 : (gestureState.dy * 150) / (gestureState.dy + 120);
        pullDownSwipeMargin.current.setValue(adjustedDy);
        const newValue = adjustedDy > PULL_TRIGGER_PX ? 1 : 0;
        if (newValue !== pullPosReachedState.current) {
          pullPosReachedState.current = newValue;
          Animated.timing(pullPosReachedAnimated.current, {
            toValue: newValue,
            duration: 150,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: onPanResponderFinish,
      onPanResponderTerminate: onPanResponderFinish,
    })
  );

  const refreshIndicatorColor = useMemo(
    () => (tintColor ? tintColor : colors && colors.length ? colors[0] : null),
    [colors, tintColor]
  );
  const pullDownIconStyle = useMemo(
    () => ({
      width: 22,
      height: 22,
      marginBottom: 18,
      transform: [
        {
          rotate: pullPosReachedAnimated.current.interpolate({
            inputRange: [0, 1],
            outputRange: ['90deg', '270deg'],
          }),
        },
      ],
    }),
    []
  );

  const containerStyle = useMemo(
    () => [style, { overflowY: 'hidden', overflow: 'hidden', paddingTop: progressViewOffset }],
    [progressViewOffset, style]
  );
  const indicatorTransformStyle = useMemo(
    () => ({
      alignSelf: 'center',
      marginTop: -40,
      height: 40,
      transform: [{ translateY: pullDownSwipeMargin.current }],
    }),
    []
  );

  const AnimatedContentContainer = useMemo(
    () => withAnimated((childProps) => <children.props.children.type {...childProps} />),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const newContentContainerStyle = useMemo(
    () => [children.props.children.props.style, { transform: [{ translateY: pullDownSwipeMargin.current }] }],
    [children.props.children.props.style]
  );
  const newChildren = React.cloneElement(
    children,
    null,
    <>
      <Animated.View style={indicatorTransformStyle}>
        {refreshing ? (
          <>
            <ActivityIndicator
              color={refreshIndicatorColor || undefined}
              size={size || undefined}
              style={{ marginVertical: 10 }}
            />
            {title ? <Text style={{ color: titleColor, textAlign: 'center', marginTop: 5 }}>{title}</Text> : null}
          </>
        ) : (
          <Animated.Image source={{ uri: arrowIcon }} style={pullDownIconStyle} />
        )}
      </Animated.View>
      <AnimatedContentContainer {...children.props.children.props} style={newContentContainerStyle} />
    </>
  );

  return (
    <View ref={containerRef} style={containerStyle} {...panResponder.current.panHandlers}>
      {newChildren}
    </View>
  );
}

function withAnimated(WrappedComponent) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  class WithAnimated extends React.Component {
    static displayName = `WithAnimated(${displayName})`;

    render() {
      return <WrappedComponent {...this.props} />;
    }
  }

  return Animated.createAnimatedComponent(WithAnimated);
}

/**
 * RN Web does not implement RefreshControl — soft pull threshold on web PWA.
 */
export const RefreshControl = Platform.OS === 'web' ? SoftWebRefreshControl : NativeRefreshControl;

export default RefreshControl;
