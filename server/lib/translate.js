import { ImportTerminologyCommand, TranslateClient, TranslateDocumentCommand, TranslateTextCommand } from '@aws-sdk/client-translate'; // ES Modules import
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  region: process.env.AWS_TRANSLATE_REGION,
};
if (process.env.AWS_TRANSLATE_ACCESS_KEY_ID && process.env.AWS_TRANSLATE_SECRET_ACCESS_KEY) {
  config.credentials = {
    accessKeyId: process.env.AWS_TRANSLATE_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_TRANSLATE_SECRET_ACCESS_KEY,
  };
}
const client = new TranslateClient(config);

// create/update custom terminology
try {
  await client.send(
    new ImportTerminologyCommand({
      Name: 'WEBVTT',
      MergeStrategy: 'OVERWRITE',
      TerminologyData: {
        Format: 'CSV',
        File: fs.readFileSync(path.resolve(__dirname, 'translate.terminology.csv')),
        Directionality: 'MULTI',
      },
    })
  );
} catch (error) {
  console.error(error);
}

export async function translateDocument(Content, SourceLanguageCode, TargetLanguageCode) {
  const options = {
    Document: {
      Content,
      ContentType: 'text/plain',
    },
    SourceLanguageCode,
    TargetLanguageCode,
    TerminologyNames: ['WEBVTT'],
  };
  const response = await client.send(new TranslateDocumentCommand(options));
  const { TranslatedDocument } = response;
  return TranslatedDocument.Content;
}

export async function translateText(Text, SourceLanguageCode, TargetLanguageCode) {
  const options = {
    Text,
    SourceLanguageCode,
    TargetLanguageCode,
  };
  const response = await client.send(new TranslateTextCommand(options));
  const { TranslatedText } = response;
  return TranslatedText;
}

export default {
  translateDocument,
  translateText,
};
