const { createNode, createLeafNode } = require('./graph')
const { partition2dArray, transpose } = require('../../array2d-utils')
const { getAttributeValuesFrequencies, calcMatrixInfoGain, calcContinuousThresholdValue } = require('./utils')

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

function getIndexesOfColumnsWithIdenticalValues(data) {
	return transpose(data)
		.map((row, idx) => [row, idx])
		.filter(([row]) => new Set(row).size === 1)
		.map(([, origIdx]) => origIdx)
}

function excludeRedundantAttributes(data, columnNames) {
	const redundantColIndexes = getIndexesOfColumnsWithIdenticalValues(data)
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

function constructId3Tree({ data, columnNames, continuousAttributes }) {
	const decisionsFreq = calcDecisionsFrequency(data)
	const mostFrequentDecision = decisionsFreq[0] > decisionsFreq[1] ? 0 : 1

	const nodeInfo = {
		decisionsFrequency: decisionsFreq,
		mostFrequentDecision,
	}

	;({ data, columnNames } = excludeRedundantAttributes(data, columnNames))
	continuousAttributes = continuousAttributes.filter(name => columnNames.includes(name))

	if (decisionsFreq.some(freq => freq === 0) || data[0].length === 1) {
		// base cases: all decision values are the same, or the data has no attributes
		// remember 'excludeRedundantAttributes'
		return createLeafNode(Object.assign(nodeInfo, { decision: mostFrequentDecision }))
	}

	const { discreteData, thresholds } = transformContinuousAttributesToDiscrete(
		data,
		columnNames,
		continuousAttributes,
	)

	const attributesInfoGain = calcMatrixInfoGain(discreteData)
	const maxInfoGainIdx = attributesInfoGain.reduce(
		(curMaxIdx, curInfoGain, idx, infoGains) => (curInfoGain > infoGains[curMaxIdx] ? idx : curMaxIdx),
		0,
	)

	Object.assign(nodeInfo, {
		infoGain: attributesInfoGain[maxInfoGainIdx],
		attribute: columnNames[maxInfoGainIdx],
	})

	if (continuousAttributes.includes(columnNames[maxInfoGainIdx])) {
		nodeInfo.isContinuous = true
		nodeInfo.threshold = thresholds.get(columnNames[maxInfoGainIdx])
	} else {
		nodeInfo.isContinuous = false
	}

	if (discreteData[0].length === 2) {
		// base cases: only 1 attribute (+ decision)
		const node = createNode(nodeInfo)

		const [attrValuesMap] = getAttributeValuesFrequencies(discreteData)

		attrValuesMap.forEach(([n, p], attrValue) => {
			node.addAdjacentNode(
				attrValue,
				createLeafNode({
					decisionsFrequency: [n, p],
					mostFrequentDecision: n > p ? 0 : 1,
					decision: n > p ? 0 : 1,
				}),
			)
		})

		return node
	}

	const columnsToSend = columnNames.filter((_, idx) => idx !== maxInfoGainIdx)

	let dataToPartition
	if (nodeInfo.isContinuous) {
		dataToPartition = transpose(data)
		dataToPartition[maxInfoGainIdx] = dataToPartition[maxInfoGainIdx].map(value => value <= nodeInfo.threshold)
		dataToPartition = transpose(dataToPartition)
	} else {
		dataToPartition = data
	}

	const node = createNode(nodeInfo)

	partition2dArray(dataToPartition, maxInfoGainIdx).forEach((partitionedData, colValueName) => {
		node.addAdjacentNode(
			colValueName,
			constructId3Tree({
				data: partitionedData,
				columnNames: columnsToSend,
				continuousAttributes,
			}),
		)
	})
	return node
}

module.exports = constructId3Tree
