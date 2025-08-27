import { defaultFormats, defaultPlugins } from "jimp";
// "png" is a typo in jimp/wasm-web exports
// see https://github.com/jimp-dev/jimp/blob/v1.6.0/plugins/wasm-webp/src/index.ts#L104
import png from "@jimp/wasm-webp";
import { createJimp } from "@jimp/core";
import { prisma } from "@linkwarden/prisma";
import { createFile } from "@linkwarden/filesystem";

const Jimp = createJimp({
  formats: [...defaultFormats, png],
  plugins: defaultPlugins,
});

export const generatePreview = async (
  buffer: Buffer,
  collectionId: number,
  linkId: number
): Promise<boolean> => {
  if (buffer && collectionId && linkId) {
    try {
      const image = await Jimp.read(buffer);

      if (!image) {
        console.log("Error generating preview: Image not found");
        return false;
      }

      const processedBuffer = await image.resize({ w: 1000 }).getBuffer('image/jpeg', { quality: 55 });

      if (
        Buffer.byteLength(processedBuffer as any) >
        1024 * 1024 * Number(process.env.PREVIEW_MAX_BUFFER || 10)
      ) {
        console.log("Error generating preview: Buffer size exceeded");
        prisma.link.update({
          where: { id: linkId },
          data: {
            preview: "unavailable",
          },
        });
        return false;
      }

      await createFile({
        data: processedBuffer,
        filePath: `archives/preview/${collectionId}/${linkId}.jpeg`,
      });

      await prisma.link.update({
        where: { id: linkId },
        data: {
          preview: `archives/preview/${collectionId}/${linkId}.jpeg`,
        },
      });

      return true;
    } catch (err) {
      console.error("Error processing the image:", err);
    }
  }

  return false;
};
