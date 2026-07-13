import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';

/**
 * Fullscreen image viewer. Optional delete (staff).
 */
export default function ImageLightbox({
  visible,
  uri,
  onClose,
  canDelete = false,
  onDelete,
  deleting = false,
}) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!uri) return null;

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="ปิด" />
        <View style={styles.toolbar} pointerEvents="box-none">
          {canDelete ? (
            <Pressable
              style={[styles.toolBtn, styles.deleteBtn]}
              onPress={onDelete}
              disabled={deleting}
              accessibilityLabel="ลบรูป"
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.toolText}>{deleting ? 'กำลังลบ…' : 'ลบ'}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 72 }} />
          )}
          <Pressable style={styles.toolBtn} onPress={onClose} accessibilityLabel="ปิด">
            <Ionicons name="close" size={22} color="#fff" />
            <Text style={styles.toolText}>ปิด</Text>
          </Pressable>
        </View>
        <Image
          source={{ uri }}
          style={{
            width: Math.min(width - 24, 960),
            height: Math.min(height - 120, 720),
            borderRadius: radius.md || 12,
          }}
          resizeMode="contain"
        />
        <Text style={styles.hint}>แตะพื้นหลังเพื่อปิด</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 56, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  toolbar: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 999,
  },
  deleteBtn: { backgroundColor: 'rgba(229, 84, 75, 0.9)' },
  toolText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hint: {
    position: 'absolute',
    bottom: spacing.xl,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
});
