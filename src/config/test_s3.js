require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.AWS_S3_BUCKET;
const KEY = 'images/test-connexion.txt';

async function test() {
  try {
    // 1. Upload d'un fichier test
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: 'Test de connexion Elearning-Mali OK',
      ContentType: 'text/plain'
    }));
    console.log('✅ Upload réussi:', KEY);

    // 2. Lecture du fichier
    const getResult = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    console.log('✅ Lecture réussie, statut:', getResult.$metadata.httpStatusCode);

    // 3. Suppression du fichier test
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: KEY }));
    console.log('✅ Suppression réussie');

    console.log('\n🎉 S3 est correctement configuré et fonctionnel !');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error('Code:', err.Code || err.name);
  }
}

test();
