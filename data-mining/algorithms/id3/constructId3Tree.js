const { createNode, createLeafNode } = require('./graph')
const { partition2dArray, transpose } = require('../../array2d-utils')
const { calcMatrixGainRatio, calcContinuousThresholdValue, fillMissingValues } = require('./utils')

function calcDecisionsFrequency(data) {
	return data
		.map(row => row.at(-1))
		.reduce(
			(acc, decision) => {
				acc[decision]++
				return acc
			},
			[0, 0],
		)
}

function getValuesFrequencies(array) {
	return array
		.reduce((map, value) => {
			if (!map.has(value)) map.set(value, 0)

			map.set(value, map.get(value) + 1)

			return map
		}, new Map())
}

function getIndexesOfRedundantAttributes(data) {
	return transpose(data)
		.slice(0, -1)
		.map((col, idx) => [col, idx])
		.filter(([col]) => {
			const uniqueValues = new Set(col)
			return uniqueValues.size === 1 || (uniqueValues.size === 2 && uniqueValues.has(null))
		})
		.map(([, origIdx]) => origIdx)
}

function excludeRedundantAttributes(data, columnNames) {
	const redundantColIndexes = getIndexesOfRedundantAttributes(data)

	if (!redundantColIndexes.length) return { data, columnNames }

	const cleanedData = transpose(transpose(data).filter((_, idx) => !redundantColIndexes.includes(idx)))
	const cleanedColumnNames = columnNames.filter((_, idx) => !redundantColIndexes.includes(idx))

	return { data: cleanedData, columnNames: cleanedColumnNames }
}

function transformContinuousAttributesToDiscrete(data, columnNames, continuousAttributes) {
	const continuosIndexes = continuousAttributes
		.map(contAttr => columnNames.findIndex(colName => colName === contAttr))

	const dataTranspose = transpose(data)

	const thresholds = continuosIndexes
		.map(contIdx => {
			const { threshold } = calcContinuousThresholdValue(dataTranspose[contIdx], dataTranspose.at(-1))
			const attributeName = columnNames[contIdx]
			return { attributeName, threshold }
		})
		.reduce((acc, { threshold, attributeName }) => {
			acc.set(attributeName, threshold)
			return acc
		}, new Map())

	const discreteData = transpose(
		dataTranspose.map((attrValues, idx) => {
			if (!continuosIndexes.includes(idx)) return attrValues
			const attrName = columnNames[idx]
			return attrValues.map(value => value <= thresholds.get(attrName))
		}),
	)

	return { thresholds, discreteData }
}

function constructId3Tree({
	data: dataArg,
	columnNames: columnNamesArg,
	continuousAttributes: continuousAttributesArg,
}) {
	const { data, columnNames } = excludeRedundantAttributes(dataArg, columnNamesArg)
	const continuousAttributes = continuousAttributesArg.filter(name => columnNames.includes(name))

	const decisionsFreq = calcDecisionsFrequency(data)
	const mostFrequentDecision = decisionsFreq[0] > decisionsFreq[1] ? 0 : 1

	const nodeInfo = {
		decisionsFrequency: decisionsFreq,
		mostFrequentDecision,
	}

	if (decisionsFreq.some(freq => freq === 0) || data[0].length === 1) {
		// base cases: all decision values are the same, or the data has no attributes
		// remember 'excludeRedundantAttributes'
		return createLeafNode(Object.assign(nodeInfo, { decision: mostFrequentDecision }))
	}

	const dataNoMissing = transpose(transpose(data).map(col => fillMissingValues(col)))

	const { discreteData, thresholds } = transformContinuousAttributesToDiscrete(
		dataNoMissing,
		columnNames,
		continuousAttributes,
	)

	const attributesGainRatio = calcMatrixGainRatio(discreteData)
	const maxGainRatioIdx = attributesGainRatio.reduce(
		(curMaxIdx, curGainRatio, idx, gainRatios) => (curGainRatio > gainRatios[curMaxIdx] ? idx : curMaxIdx),
		0,
	)

	const attributeValuesFrequencies = getValuesFrequencies(transpose(discreteData)[maxGainRatioIdx])
	const { value: mostFrequentAttributeValue } = [...attributeValuesFrequencies.entries()]
		.reduce((best, [value, freq]) => {
			if (best === null || freq > best.freq) return { value, freq }
			return best
		}, null)

	Object.assign(nodeInfo, {
		gainRatio: attributesGainRatio[maxGainRatioIdx],
		attribute: columnNames[maxGainRatioIdx],
		attributeValuesFrequencies,
		mostFrequentAttributeValue,
	})

	if (continuousAttributes.includes(columnNames[maxGainRatioIdx])) {
		nodeInfo.isContinuous = true
		nodeInfo.threshold = thresholds.get(columnNames[maxGainRatioIdx])
	} else {
		nodeInfo.isContinuous = false
	}

	const columnsToSend = columnNames.filter((_, idx) => idx !== maxGainRatioIdx)

	let dataToPartition = transpose(data)
	dataToPartition[maxGainRatioIdx] = transpose(discreteData)[maxGainRatioIdx]
	dataToPartition = transpose(dataToPartition)

	const childNodes = []

	partition2dArray(dataToPartition, maxGainRatioIdx).forEach((partitionedData, colValueName) => {
		const edge = colValueName
		const child = constructId3Tree({
			data: partitionedData,
			columnNames: columnsToSend,
			continuousAttributes,
		})

		childNodes.push({ child, edge })
	})

	// check for pruning

	if (childNodes.every(({ child }, idx) => {
		if (!child.isLeaf()) return false

		if (idx === 0) return true

		return child.getNodeInfo().decision === childNodes[idx - 1].child.getNodeInfo().decision
	})) {
		Object.assign(nodeInfo, {
			isPruned: true,
			decision: mostFrequentDecision,
		})
		return createLeafNode(nodeInfo)
	}

	const node = createNode(nodeInfo)

	childNodes.forEach(({ child, edge }) => {
		node.addAdjacentNode(edge, child)
	})

	return node
}

module.exports = constructId3Tree
