const { TextractClient, AnalyzeExpenseCommand } = require('@aws-sdk/client-textract');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

exports.handler = async function (event) {
	const REGION = process.env.REGION;

	const { image } = JSON.parse(event.body);

	const input = {
		Document: {
			S3Object: {
				Bucket: process.env.BUCKET_NAME,
				Name: image.name,
			},
		},
	};

	try {
		const client = new TextractClient({ region: REGION });
		const commandTextract = new AnalyzeExpenseCommand(input);
		const responseTextract = await client.send(commandTextract);

		const resultsFolder = 'analyze-expense/';
		const resultObjectKey = resultsFolder + image.name + '-result.json';
		const s3Client = new S3Client({ region: REGION });
		const putObjectParams = {
			Bucket: process.env.BUCKET_NAME,
			Key: resultObjectKey,
			Body: JSON.stringify(responseTextract),
		};
		const commandS3 = new PutObjectCommand(putObjectParams);
		await s3Client.send(commandS3);

		return {
			statusCode: 200,
			body: JSON.stringify(responseTextract),
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		};
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
};
