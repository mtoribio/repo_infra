exports.handler = async function (event) {
	const response = {
		statusCode: 200,
		body: JSON.stringify('Welcome to the Textract API'),
		headers: {
			'Access-Control-Allow-Origin': '*',
		},
	};
	return response;
};
