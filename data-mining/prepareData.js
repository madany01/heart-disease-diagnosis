function moveDecisionAttributeToLastColumn(data, attributes, decisionAttribute) {
	const j = attributes.findIndex(attr => attr === decisionAttribute)

	const n = attributes.length

	if (j === n - 1) return { data, attributes }

	data = [...data]
	attributes = [...data]

	;[data[j], data[n - 1]] = [data[n - 1], data[j]]
	;[attributes[j], attributes[n - 1]] = [attributes[n - 1], attributes[j]]

	return { data, attributes }
}

function replaceMissingData(data, missingDataValues) {
	return data.map(row => row.map(value => (missingDataValues.includes(value) ? null : value)))
}

function castColumnsToNumber(data, columnIndexes) {
	return data.map(row => {
		row = [...row]
		columnIndexes.forEach(colIdx => {
			row[colIdx] = Number(row[colIdx])
		})
		return row
	})
}

function replaceDecisionAttributesWith0(data, positiveValues) {
	return data.map(row => {
		row = [...row]
		const value = row[row.length - 1]
		row[row.length - 1] = value === positiveValues ? 1 : 0
		return row
	})
}

function prepareData({
	data: origData,
	decisionAttribute,
	missingDataValues,
	continuosAttributes,
	positiveDecisionValue,
	renameDecisionTo = null,
}) {
	let attributes = origData[0]
	let data = origData.slice(1)

	;({ data, attributes } = moveDecisionAttributeToLastColumn(data, attributes, decisionAttribute))
	data = replaceMissingData(data, missingDataValues)

	const continuosAttributesIndexes = continuosAttributes.map(attr => attributes.findIndex(v => v === attr))
	data = castColumnsToNumber(data, continuosAttributesIndexes)

	data = replaceDecisionAttributesWith0(data, positiveDecisionValue)

	if (renameDecisionTo) attributes[attributes.length - 1] = renameDecisionTo

	return { data, attributes }
}

module.exports = prepareData
