const { transpose } = require('../../array2d-utils')
const { fillMissingValues } = require('./utils')
const createClassifier = require('./createId3Classifier')
const constructId3Tree = require('./constructId3Tree')

function trainId3Classifier([columnNames, ...data], continuousAttributes = []) {
	data = transpose(
		transpose(data)
			.map((attrRow, idx, transposed) => {
				if (idx === transposed.length - 1) return attrRow
				return fillMissingValues(attrRow)
			}),
	)

	const rootNode = constructId3Tree({ data, columnNames, continuousAttributes })

	return createClassifier({ rootNode, continuousAttributes })
}

module.exports = trainId3Classifier
