import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "react-native-paper";

interface BarProps {
  delay: number;
  height: number;
}

const Bar: React.FC<BarProps> = ({ delay, height: targetHeight }) => {
  const scaleY = useSharedValue(1);
  const theme = useTheme();

  useEffect(() => {
    scaleY.value = withRepeat(
      withSequence(
        withTiming(targetHeight, {
          duration: 400 + delay,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 400 + delay,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, [delay, targetHeight, scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
    backgroundColor: theme.colors.primary,
  }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
};

const SoundWave: React.FC = () => {
  return (
    <View style={styles.container}>
      <Bar delay={0} height={2.5} />
      <Bar delay={100} height={4} />
      <Bar delay={200} height={3} />
      <Bar delay={150} height={5} />
      <Bar delay={50} height={2} />
      <Bar delay={120} height={4.5} />
      <Bar delay={180} height={3.5} />
      <Bar delay={90} height={5.5} />
      <Bar delay={220} height={2.8} />
      <Bar delay={130} height={4.2} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 4,
  },
  bar: {
    width: 3,
    height: 10,
    borderRadius: 2,
  },
});

export default SoundWave;
