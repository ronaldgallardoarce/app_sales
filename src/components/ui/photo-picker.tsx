import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Reusable photo capture + gallery picker with in-place preview. Used for task
 * photo responses and for exceptional-exit evidence.
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
  const remaining = max - uris.length;

  const addUris = (added: string[]) => onChange([...uris, ...added].slice(0, max));
  const removeAt = (index: number) => onChange(uris.filter((_, i) => i !== index));

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Habilitá el acceso a la cámara para tomar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) addUris(result.assets.map((a) => a.uri));
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Habilitá el acceso a la galería para adjuntar fotos.');
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

  const showOptions = () => {
    if (remaining <= 0) return;
    Alert.alert('Agregar foto', 'Elegí de dónde tomar la imagen', [
      { text: 'Tomar foto', onPress: takePhoto },
      { text: 'Elegir de galería', onPress: pickFromGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
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

        {remaining > 0 ? (
          <Pressable
            onPress={showOptions}
            style={[styles.add, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Icon name="camera" size={22} color={theme.accent} />
            <ThemedText type="small" style={{ color: theme.accent }}>
              Agregar
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
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
  add: {
    width: 90,
    height: 90,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
