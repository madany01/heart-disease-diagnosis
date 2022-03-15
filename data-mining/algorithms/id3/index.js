const createClassifier = require('./createId3Classifier')
const constructId3Tree = require('./constructId3Tree')

function trainId3Classifier([columnNames, ...data], continuousAttributes = []) {
	const rootNode = constructId3Tree({ data, columnNames, continuousAttributes })

	return createClassifier({ rootNode, continuousAttributes })
}

module.exports = trainId3Classifier
