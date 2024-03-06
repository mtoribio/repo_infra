const { TextractClient, AnalyzeDocumentCommand } = require('@aws-sdk/client-textract');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

exports.handler = async function (event) {
	const REGION = process.env.REGION;
	const BUCKET_NAME = process.env.BUCKET_NAME;
	const textractClient = new TextractClient({ region: REGION });
	const s3Client = new S3Client({ region: REGION });

	const extPermitido = ['jpeg', 'jpg', 'png', 'tiff', 'pdf'];

	try {
		const contentType = event.headers['Content-Type'] ?? event.headers['content-type'];
		const extension = contentType.split('/')[1].toLowerCase();

		if (!extPermitido.includes(extension)) {
			throw new Error('El tipo de archivo debe ser ' + extPermitido);
		}

		const imageData = Buffer.from(event.body, 'base64');

		const timestamp = new Date().getTime();
		const randomString = Math.random().toString(36).substring(2, 15);
		const filename = `${timestamp}-${randomString}`;

		const input = {
			Document: {
				Bytes: imageData,
			},
			FeatureTypes: ['TABLES' || 'FORMS' || 'QUERIES' || 'SIGNATURES' || 'LAYOUT'],
		};

		const textractCommand = new AnalyzeDocumentCommand(input);
		const textractResponse = await textractClient.send(textractCommand);

		const resultsFolder = 'analyze-document/results/';
		const resultObjectKey = `${resultsFolder}${filename}.result.json`;

		// Configurar los parámetros para subir el json de resultados a S3
		const textractResponseParams = {
			Bucket: BUCKET_NAME,
			Key: resultObjectKey,
			Body: JSON.stringify(textractResponse),
		};

		const s3CommandResponse = new PutObjectCommand(textractResponseParams);
		await s3Client.send(s3CommandResponse);

		const imagesFolder = 'analyze-document/images/';
		const imageObjectKey = `${imagesFolder}${filename}.${extension}`;

		// Configurar los parámetros para subir la imagen a S3
		const imageParams = {
			Bucket: BUCKET_NAME,
			Key: imageObjectKey,
			Body: imageData,
			ContentType: contentType,
		};

		const s3CommandImage = new PutObjectCommand(imageParams);
		await s3Client.send(s3CommandImage);

		return {
			statusCode: 200,
			body: JSON.stringify(textractResponse),
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify({ error: error.message }),
		};
	}
};
