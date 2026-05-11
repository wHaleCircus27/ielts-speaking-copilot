export type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

export async function copyTextToClipboard(text: string, writer: ClipboardWriter = navigator.clipboard): Promise<void> {
  await writer.writeText(text);
}
