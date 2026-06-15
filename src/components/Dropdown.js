import React, { useState } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { colors, spacing, radius } from '../theme';

/** Compact dropdown matching the "เลือกตามช่าง ▼" control in the sketch. */
export default function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.control} onPress={() => setOpen(true)}>
        <Text style={styles.controlText} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.caret}>▼</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item === value && styles.optionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.navySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  controlText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
    flexShrink: 1,
  },
  caret: {
    fontSize: 10,
    color: colors.navySoft,
    marginLeft: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,26,56,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  menu: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    maxHeight: 320,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.navy,
    fontWeight: '700',
  },
});
