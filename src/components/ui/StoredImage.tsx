import React from "react";
import { Image, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";

import { useSignedMedia } from "@/hooks/useSignedMedia";

type Props = Omit<ImageProps, "source"> & {
  /** Chemin dans le stockage, ou adresse enregistree avant la fermeture. */
  path?: string | null;
  style?: StyleProp<ViewStyle> | ImageProps["style"];
  /** Ce qui s'affiche pendant la resolution et si le droit manque. */
  fallback?: React.ReactNode;
};

/**
 * Une image du stockage prive.
 *
 * Le bucket ne repond plus a une adresse publique : chaque affichage demande
 * une URL signee de courte duree. Le composant existe pour que ce detail ne
 * soit pas repete a dix endroits -- et pour qu'on ne l'oublie pas au onzieme.
 *
 * Tant que l'adresse n'est pas resolue, ou si le droit manque, c'est le repli
 * qui s'affiche : une vignette absente n'est pas une erreur.
 */
export default function StoredImage({ path, fallback = null, style, ...rest }: Props) {
  const uri = useSignedMedia(path);

  if (!uri) {
    return fallback ? <View style={style as StyleProp<ViewStyle>}>{fallback}</View> : null;
  }

  return <Image source={{ uri }} style={style as ImageProps["style"]} {...rest} />;
}
