import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Overlay, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Reusable photo capture + gallery picker with in-place preview. Used for task
 * photo responses and for exceptional-exit evidence.
 *
 * Camera and gallery are two separate buttons, and permission problems are shown
 * inline rather than in a dialog — deliberately. This component renders inside
 * bottom sheets, which are `Modal`s: a dialog raised from the app root would be
 * presented *below* the open sheet and never become visible. Everything it needs
 * to show has to live in its own view tree.
 */
export function PhotoPicker({
  uris,
  onChange,
  max = 3,
}: {
  uris: string[];
  onChange: (uris: string[]) => void;
  max?: number;
}) {
  const theme = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const remaining = max - uris.length;

  const addUris = (added: string[]) => onChange([...uris, ...added].slice(0, max));
  const removeAt = (index: number) => onChange(uris.filter((_, i) => i !== index));

  const takePhoto = async () => {
    setPermissionNotice(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPermissionNotice('Habilitá el acceso a la cámara para tomar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) addUris(result.assets.map((a) => a.uri));
  };

  const pickFromGallery = async () => {
    setPermissionNotice(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionNotice('Habilitá el acceso a la galería para adjuntar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled) addUris(result.assets.map((a) => a.uri));
  };

  return (
    <View style={styles.group}>
      <View style={styles.grid}>
        {uris.map((uri, i) => (
          <Pressable key={uri} onPress={() => setPreview(uri)} style={styles.tile}>
            <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
            <Pressable
              hitSlop={6}
              onPress={() => removeAt(i)}
              style={[styles.remove, { backgroundColor: theme.danger }]}>
              <Icon name="xmark" size={11} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        ))}

      </View>

      {/* Two direct buttons instead of a chooser: one tap less, and no second modal
          that a bottom sheet would hide. */}
      {remaining > 0 ? (
        <View style={styles.sourceRow}>
          <Pressable
            onPress={takePhoto}
            style={[styles.sourceButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Icon name="camera" size={15} color={theme.accent} />
            <ThemedText type="smallBold" style={[styles.sourceLabel, { color: theme.accent }]}>
              Cámara
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={pickFromGallery}
            style={[styles.sourceButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Icon name="photo" size={15} color={theme.accent} />
            <ThemedText type="smallBold" style={[styles.sourceLabel, { color: theme.accent }]}>
              Galería
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {permissionNotice ? (
        <View style={[styles.notice, { backgroundColor: theme.dangerSoft }]}>
          <Icon name="exclamationmark.circle" size={13} color={theme.danger} />
          <ThemedText style={[styles.noticeText, { color: theme.danger }]}>{permissionNotice}</ThemedText>
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {uris.length}/{max} fotos · tocá una para ampliarla
      </ThemedText>

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.preview} contentFit="contain" /> : null}
          <Pressable
            onPress={() => setPreview(null)}
            style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="xmark" size={18} color={theme.text} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: 90,
    height: 90,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input - 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sourceLabel: {
    fontSize: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: '92%',
    height: '80%',
  },
  close: {
    position: 'absolute',
    top: 60,
    right: Spacing.four,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
