import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const client = new TranscribeClient();
const s3client = new S3Client({
  forcePathStyle: true,
});

async function startTranscriptionJob(TranscriptionJobName, MediaFileUri, OutputKey) {
  const options = {
    TranscriptionJobName,
    IdentifyLanguage: true,
    Media: {
      MediaFileUri,
    },
    OutputBucketName: process.env.AWS_TRANSCRIBE_BUCKET,
    OutputKey,
    Subtitles: {
      Formats: ['vtt', 'srt'],
      OutputStartIndex: 1,
    },
  };
  return client.send(new StartTranscriptionJobCommand(options));
}

async function getTranscriptionJob(TranscriptionJobName) {
  const options = {
    TranscriptionJobName,
  };
  return client.send(new GetTranscriptionJobCommand(options));
}

async function getObject(Key) {
  const response = await s3client.send(
    new GetObjectCommand({
      Bucket: process.env.AWS_TRANSCRIBE_BUCKET,
      Key,
    })
  );
  const filePath = path.resolve(__dirname, '../tmp/downloads', Key);
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
  await fs.promises.mkdir(dirPath, { recursive: true });
  await fs.promises.writeFile(filePath, response.Body);
  return filePath;
}

function putObject(Key, filePath) {
  return s3client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_TRANSCRIBE_BUCKET,
      Key,
      Body: fs.createReadStream(filePath),
    })
  );
}

export default {
  startTranscriptionJob,
  getTranscriptionJob,
  putObject,
  getObject,
};
