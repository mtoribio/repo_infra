const {
    TextractClient,
    AnalyzeDocumentCommand,
} = require("@aws-sdk/client-textract");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

exports.handler = async function (event) {
    const REGION = process.env.REGION;

    const { image } = JSON.parse(event.body);

    // Obtener el archivo de la solicitud
    const fileData = Buffer.from(image.file, "base64");

    const input = {
        Document: {
            Bytes: fileData,
        },
        FeatureTypes: [
            "TABLES" || "FORMS" || "QUERIES" || "SIGNATURES" || "LAYOUT",
        ],
    };

    try {
        const textractClient = new TextractClient({ region: REGION });
        const textractCommand = new AnalyzeDocumentCommand(input);
        const textractResponse = await textractClient.send(textractCommand);

        const s3Client = new S3Client({ region: REGION });

        const resultsFolder = "analyze-document/results/";
        const resultObjectKey =
            resultsFolder + image.name.split(".")[0] + ".result.json";

        // Configurar los parámetros para subir el json de resultados a S3
        const textractResponseParams = {
            Bucket: process.env.BUCKET_NAME,
            Key: resultObjectKey,
            Body: JSON.stringify(textractResponse),
        };

        const s3CommandResponse = new PutObjectCommand(textractResponseParams);
        await s3Client.send(s3CommandResponse);

        const imagesFolder = "analyze-document/images/";
        const extension = image.name.split(".")[0] ?? "jpeg";
        const contentType =
            extension !== "pdf"
                ? `image/${extension}`
                : `application/${extension}`;
        const imageObjectKey = imagesFolder + image.name;

        // Configurar los parámetros para subir la imagen a S3
        const imageParams = {
            Bucket: process.env.BUCKET_NAME,
            Key: imageObjectKey,
            Body: fileData,
            ContentType: contentType,
        };

        const s3CommandImage = new PutObjectCommand(imageParams);
        await s3Client.send(s3CommandImage);

        return {
            statusCode: 200,
            body: JSON.stringify(textractResponse),
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
