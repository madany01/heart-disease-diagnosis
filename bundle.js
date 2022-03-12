/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./data-mining/algorithms/bayes/createBayesClassifier.js":
/*!***************************************************************!*\
  !*** ./data-mining/algorithms/bayes/createBayesClassifier.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { calcGaussianDensity } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/bayes/utils.js")

function createBayesClassifier({
	decisionsFreqs,
	discreteAttributesFreqs,
	continuosAttributesStats,
}) {
	const decisionsFreqsSum = decisionsFreqs.reduce((acc, freq) => acc + freq, 0)
	const [P0, P1] = decisionsFreqs.map(freq => freq / decisionsFreqsSum)

	function getDiscreteAttrsProbs(object) {
		return Object
			.entries(object)
			.filter(([attr, value]) => (
				discreteAttributesFreqs.has(attr) && discreteAttributesFreqs.get(attr).has(value)
			))
			.reduce(
				(probs, [attr, value]) => {
					probs.forEach((_, idx) => {
						const attrFreqMap = discreteAttributesFreqs.get(attr)
						const numUniqueValues = attrFreqMap.size
						probs[idx] *= (attrFreqMap.get(value)[idx] + 1) / (decisionsFreqs[idx] + numUniqueValues)
					})
					return probs
				},
				[1, 1],
			)
	}

	function getContinuousAttrsProbs(object) {
		return Object
			.entries(object)
			.filter(([attr]) => continuosAttributesStats.has(attr))
			.reduce(
				(probs, [attr, value]) => {
					probs.forEach((_, idx) => {
						const mu = continuosAttributesStats.get(attr)[idx].get('mu')
						const sigma = continuosAttributesStats.get(attr)[idx].get('sigma')
						probs[idx] *= calcGaussianDensity(value, mu, sigma)
					})
					return probs
				},
				[1, 1],
			)
	}

	function classify(object) {
		const discreteAttrsProbs = getDiscreteAttrsProbs(object)
		const continuousAttrsProbs = getContinuousAttrsProbs(object)

		const probs = [discreteAttrsProbs, continuousAttrsProbs]
			.reduce((acc, attrProb) => {
				acc[0] *= attrProb[0]
				acc[1] *= attrProb[1]
				return acc
			}, [P0, P1])

		const probsSum = probs.reduce((acc, p) => acc + p, 0)
		probs.forEach((_, idx) => {
			probs[idx] /= probsSum
		})
		return {
			decision: probs[0] > probs[1] ? 0 : 1,
			0: probs[0],
			1: probs[1],
		}
	}

	return {
		classify,
	}
}
module.exports = createBayesClassifier


/***/ }),

/***/ "./data-mining/algorithms/bayes/index.js":
/*!***********************************************!*\
  !*** ./data-mining/algorithms/bayes/index.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const createBayesClassifier = __webpack_require__(/*! ./createBayesClassifier */ "./data-mining/algorithms/bayes/createBayesClassifier.js")

function calcAttributesFrequencies(array2d) {
	const decisionsFreqs = array2d.reduce(
		(acc, row) => {
			acc[row.at(-1)]++
			return acc
		},
		[0, 0],
	)

	const attributesFrequencies = transpose(array2d)
		.map((attrRow, _, transposedArr) => transpose([attrRow, transposedArr.at(-1)]))
		.slice(0, -1)
		.map(attrRowAndDecision => attrRowAndDecision.reduce((attrMap, [attrValue, decision]) => {
			if (!attrMap.has(attrValue)) attrMap.set(attrValue, [0, 0])
			attrMap.get(attrValue)[decision]++
			return attrMap
		}, new Map()))

	return {
		attributesFrequencies,
		decisionsFreqs,
	}
}
function calcAttributesMuSigma2(array2d) {
	return (
		transpose(array2d)
			.map(attrRow => attrRow
				.reduce(
					(acc, val, idx) => {
						const decision = array2d[idx].at(-1)
						acc[decision].push(val)
						return acc
					},
					[[], []],
				)
				.map(groupedAttrRow => groupedAttrRow.filter(val => val !== null))
				.map(groupedAttrRow => {
					const n = groupedAttrRow.length
					const mu = groupedAttrRow.reduce((acc, val) => acc + val, 0) / n
					const sigma = (groupedAttrRow.reduce((acc, val) => acc + (val - mu) ** 2, 0) / (n - 1)) ** 0.5
					return new Map(Object.entries({ mu, sigma }))
				}))
			.slice(0, -1)
	)
}

function trainNaiveBayesClassifier([attrNames, ...data], continuosAttributes = []) {
	const continuosAttributesIndexes = continuosAttributes.map(value => attrNames.findIndex(v => v === value))

	const discreteAttributesIndexes = attrNames
		.slice(0, -1)
		.map((_, idx) => idx)
		.filter(idx => !continuosAttributesIndexes.includes(idx))

	const dataTranspose = transpose(data)
	const decisionArray = dataTranspose.at(-1)

	let continuosAttributesStats = calcAttributesMuSigma2(
		transpose([...continuosAttributesIndexes.map(idx => dataTranspose[idx]), decisionArray]),
	)

	continuosAttributesStats = new Map(
		continuosAttributesStats.map((attrStats, idx) => [attrNames[continuosAttributesIndexes[idx]], attrStats]),
	)

	const result = calcAttributesFrequencies(
		transpose([...discreteAttributesIndexes.map(idx => dataTranspose[idx]), decisionArray]),
	)

	const { decisionsFreqs } = result

	let { attributesFrequencies: discreteAttributesFreqs } = result

	discreteAttributesFreqs
		.filter(attrMap => !attrMap.has(null))
		.forEach(attrMap => {
			attrMap.delete(null)
		})

	discreteAttributesFreqs = new Map(
		discreteAttributesFreqs.map((attrProbs, idx) => [attrNames[discreteAttributesIndexes[idx]], attrProbs]),
	)

	return createBayesClassifier({ decisionsFreqs, discreteAttributesFreqs, continuosAttributesStats })
}

module.exports = trainNaiveBayesClassifier


/***/ }),

/***/ "./data-mining/algorithms/bayes/utils.js":
/*!***********************************************!*\
  !*** ./data-mining/algorithms/bayes/utils.js ***!
  \***********************************************/
/***/ ((module) => {

function calcGaussianDensity(x, mu, sigma) {
	return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (((2 * Math.PI) ** 0.5) * sigma)
}

module.exports = { calcGaussianDensity }


/***/ }),

/***/ "./data-mining/algorithms/id3/constructId3Tree.js":
/*!********************************************************!*\
  !*** ./data-mining/algorithms/id3/constructId3Tree.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { createNode, createLeafNode } = __webpack_require__(/*! ./graph */ "./data-mining/algorithms/id3/graph.js")
const { partition2dArray, transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const { getAttributeValuesFrequencies, calcMatrixGainRatio, calcContinuousThresholdValue } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")

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

	const attributesGainRatio = calcMatrixGainRatio(discreteData)
	const maxGainRatioIdx = attributesGainRatio.reduce(
		(curMaxIdx, curGainRatio, idx, gainRatios) => (curGainRatio > gainRatios[curMaxIdx] ? idx : curMaxIdx),
		0,
	)

	Object.assign(nodeInfo, {
		gainRatio: attributesGainRatio[maxGainRatioIdx],
		attribute: columnNames[maxGainRatioIdx],
	})

	if (continuousAttributes.includes(columnNames[maxGainRatioIdx])) {
		nodeInfo.isContinuous = true
		nodeInfo.threshold = thresholds.get(columnNames[maxGainRatioIdx])
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

	const columnsToSend = columnNames.filter((_, idx) => idx !== maxGainRatioIdx)

	let dataToPartition
	if (nodeInfo.isContinuous) {
		dataToPartition = transpose(data)
		dataToPartition[maxGainRatioIdx] = dataToPartition[maxGainRatioIdx].map(value => value <= nodeInfo.threshold)
		dataToPartition = transpose(dataToPartition)
	} else {
		dataToPartition = data
	}

	const node = createNode(nodeInfo)

	partition2dArray(dataToPartition, maxGainRatioIdx).forEach((partitionedData, colValueName) => {
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


/***/ }),

/***/ "./data-mining/algorithms/id3/createId3Classifier.js":
/*!***********************************************************!*\
  !*** ./data-mining/algorithms/id3/createId3Classifier.js ***!
  \***********************************************************/
/***/ ((module) => {

function createId3Classifier({ rootNode, continuousAttributes }) {
	const nodes = getAllTreeNodes(rootNode)

	function classify(object) {
		let node = rootNode
		const path = []
		let decision = null

		while (true) {
			const nodeInfo = node.getNodeInfo()

			if (node.isLeaf()) {
				decision = nodeInfo.decision
				break
			}

			const { attribute } = nodeInfo
			path.push(attribute)

			if (!(attribute in object) || object[attribute] === null) {
				decision = nodeInfo.mostFrequentDecision
				break
			}

			const edge = nodeInfo.isContinuous ? object[attribute] <= nodeInfo.threshold : object[attribute]

			const adjacentNodes = node.getAdjacentNodes()
			if (!adjacentNodes.has(edge)) {
				decision = nodeInfo.mostFrequentDecision
				break
			}

			node = adjacentNodes.get(edge)
		}

		return { decision, path }
	}

	function getRootNode() {
		return Object.freeze({ ...rootNode })
	}

	function getAllTreeNodes(root) {
		const map = new Map()

		const q = [root]

		for (let len = q.length; len > 0; len = q.length) {
			while (len--) {
				const node = q.shift()
				map.set(node.getId(), node)
				if (node.isLeaf()) continue
				node.getAdjacentNodes().forEach(adjNode => q.push(adjNode))
			}
		}

		return map
	}

	function getTreeNodes() {
		return nodes
	}

	return {
		classify,
		getTreeNodes,
		getRootNode,
	}
}
module.exports = createId3Classifier


/***/ }),

/***/ "./data-mining/algorithms/id3/graph.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/graph.js ***!
  \*********************************************/
/***/ ((module) => {

let idx = 0

function createNode(nodeInfo) {
	const id = idx++

	const adjacentNodes = new Map()

	function getNodeInfo() {
		return nodeInfo
	}

	function addAdjacentNode(edge, node) {
		adjacentNodes.set(edge, node)
	}

	function getAdjacentNodes() {
		return new Map(adjacentNodes)
	}

	function isLeaf() {
		return false
	}

	function getId() {
		return id
	}

	return {
		getId,
		isLeaf,
		addAdjacentNode,
		getAdjacentNodes,
		getNodeInfo,
	}
}

function createLeafNode(nodeInfo) {
	const id = idx++

	function isLeaf() {
		return true
	}
	function getNodeInfo() {
		return nodeInfo
	}

	function getId() {
		return id
	}

	return {
		getId,
		isLeaf,
		getNodeInfo,
	}
}

module.exports = {
	createNode,
	createLeafNode,
}


/***/ }),

/***/ "./data-mining/algorithms/id3/index.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const { fillMissingValues } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")
const createClassifier = __webpack_require__(/*! ./createId3Classifier */ "./data-mining/algorithms/id3/createId3Classifier.js")
const constructId3Tree = __webpack_require__(/*! ./constructId3Tree */ "./data-mining/algorithms/id3/constructId3Tree.js")

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


/***/ }),

/***/ "./data-mining/algorithms/id3/utils.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/utils.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")

function fillMissingValues(array) {
	const freqMap = new Map()

	array
		.filter(value => value !== null)
		.forEach(value => {
			const preFreq = freqMap.has(value) ? freqMap.get(value) : 0
			freqMap.set(value, preFreq + 1)
		})

	const freqArray = [...freqMap.entries()]

	const numNonMissingValues = freqArray.reduce((acc, [, freq]) => acc + freq, 0)

	const probArray = [...freqArray]
		.sort(([, freq1], [, freq2]) => freq1 - freq2)
		.map(([value, freq]) => [value, freq / numNonMissingValues])

	probArray.forEach((_, idx) => {
		probArray[idx][1] += idx === 0 ? 0 : probArray[idx - 1][1]
	})

	return array.map(value => {
		if (value !== null) return value
		const rand = Math.random()
		return probArray.find(([, prob]) => rand <= prob)[0]
	})
}

function getAttributeValuesFrequencies(array2d) {
	/*
	[
		{attr1V1: [n, p], attr1V2: [n, p], attr1V3: [n, p]},
		{attr2V1: [n, p], attr2V2: [n, p], attr2V3: [n, p]},
		..
	]
	*/
	return transpose(array2d)
		.map((attrRow, _, transposedArr) => [attrRow, transposedArr.at(-1)])
		.map(transpose)
		.map(attrDecision => attrDecision.reduce((map, [attrVal, decision]) => {
			if (!map.has(attrVal)) map.set(attrVal, [0, 0])
			map.get(attrVal)[decision]++
			return map
		}, new Map()))
}

function calcEntropy(array) {
	const sum = array.reduce((acc, v) => acc + v, 0)
	return -array.reduce((acc, v) => (acc + (v === 0 ? 0 : (v / sum) * Math.log2(v / sum))), 0)
}

function calcMatrixGainRatio(array2d) {
	const numSamples = array2d.length

	const attributeValuesFreqs = getAttributeValuesFrequencies(array2d)

	const dataEntropy = calcEntropy([
		attributeValuesFreqs.at(-1).get(0)[0],
		attributeValuesFreqs.at(-1).get(1)[1],
	])

	const infoEntropies = attributeValuesFreqs
		.slice(0, -1)
		.map(attrMap => (
			[...attrMap.values()].reduce((acc, [n, p]) => acc + (calcEntropy([n, p]) * (n + p)) / numSamples, 0)
		))

	const infoGains = infoEntropies.map(ie => dataEntropy - ie)

	const splitInfos = attributeValuesFreqs
		.slice(0, -1)
		.map(attrMap => [...attrMap.values()].map(([n, p]) => n + p))
		.map(attrValuesCntArray => calcEntropy(attrValuesCntArray))

	return infoGains.map((g, idx) => g / splitInfos[idx])
}

function calcContinuousThresholdValue(valuesArray, decisions) {
	const sortedUniqueValues = [...new Set(valuesArray)].sort((a, b) => a - b)

	console.assert(sortedUniqueValues.length >= 2)

	return sortedUniqueValues
		.reduce((best, _, idx) => {
			if (idx === 0) return null

			const threshold = (sortedUniqueValues[idx] + sortedUniqueValues[idx - 1]) / 2
			const [gainRatio] = calcMatrixGainRatio(
				transpose([valuesArray.map(value => value <= threshold), decisions]),
			)

			if (best === null || gainRatio > best.gainRatio) return { threshold, gainRatio }

			return best
		}, null)
}

module.exports = {
	calcContinuousThresholdValue,
	calcEntropy,
	calcMatrixGainRatio,
	fillMissingValues,
	getAttributeValuesFrequencies,
}


/***/ }),

/***/ "./data-mining/array2d-utils/index.js":
/*!********************************************!*\
  !*** ./data-mining/array2d-utils/index.js ***!
  \********************************************/
/***/ ((module) => {

function partition2dArray(array2d, columnIdx) {
	const numColumns = array2d[0].length
	columnIdx = ((columnIdx % numColumns) + numColumns) % numColumns

	return array2d.reduce((parts, row) => {
		const targetColumnValue = row[columnIdx]

		if (!parts.has(targetColumnValue)) parts.set(targetColumnValue, [])

		parts.get(targetColumnValue).push([...row.slice(0, columnIdx), ...row.slice(columnIdx + 1)])

		return parts
	}, new Map())
}

function transpose(array) {
	const rows = array.length

	if (rows === 0) return []

	const cols = array[0].length

	if (cols === undefined) return transpose([array])

	const ret = new Array(cols).fill(null).map(() => new Array(rows).fill(null))

	for (let i = 0; i < rows; i++) {
		for (let j = 0; j < cols; j++) {
			ret[j][i] = array[i][j]
		}
	}

	return ret
}

module.exports = {
	partition2dArray,
	transpose,
}


/***/ }),

/***/ "./data-mining/prepareData.js":
/*!************************************!*\
  !*** ./data-mining/prepareData.js ***!
  \************************************/
/***/ ((module) => {

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


/***/ }),

/***/ "./data-mining/heart_disease_male.csv":
/*!********************************************!*\
  !*** ./data-mining/heart_disease_male.csv ***!
  \********************************************/
/***/ ((module) => {

module.exports = [["age","chest_pain_type","rest_blood_pressure","blood_sugar","rest_electro","max_heart_rate","exercice_angina","disease"],["43","asympt","140","FALSE","normal","135","yes","positive"],["39","atyp_angina","120","FALSE","normal","160","yes","negative"],["39","non_anginal","160","TRUE","normal","160","no","negative"],["42","non_anginal","160","FALSE","normal","146","no","negative"],["49","asympt","140","FALSE","normal","130","no","negative"],["50","asympt","140","FALSE","normal","135","no","negative"],["59","asympt","140","TRUE","left_vent_hyper","119","yes","positive"],["54","asympt","200","FALSE","normal","142","yes","positive"],["59","asympt","130","FALSE","normal","125","no","positive"],["56","asympt","170","FALSE","st_t_wave_abnormality","122","yes","positive"],["52","non_anginal","140","FALSE","st_t_wave_abnormality","170","no","negative"],["60","asympt","100","FALSE","normal","125","no","positive"],["55","atyp_angina","160","TRUE","normal","143","yes","positive"],["57","atyp_angina","140","TRUE","normal","140","no","negative"],["38","asympt","110","FALSE","normal","166","no","positive"],["60","non_anginal","120","FALSE","left_vent_hyper","135","no","negative"],["55","atyp_angina","140","FALSE","normal","150","no","negative"],["50","asympt","140","FALSE","st_t_wave_abnormality","140","yes","positive"],["48","asympt","106","TRUE","normal","110","no","positive"],["39","atyp_angina","190","FALSE","normal","106","no","negative"],["66","asympt","140","FALSE","normal","94","yes","positive"],["56","asympt","155","TRUE","normal","150","yes","positive"],["44","asympt","135","FALSE","normal","135","no","positive"],["43","asympt","120","FALSE","normal","120","yes","positive"],["54","asympt","140","FALSE","normal","118","yes","positive"],["52","atyp_angina","140","FALSE","normal","138","yes","negative"],["48","asympt","120","FALSE","normal","115","no","positive"],["51","non_anginal","135","FALSE","normal","150","no","positive"],["59","non_anginal","180","FALSE","normal","100","no","negative"],["58","atyp_angina","130","FALSE","normal","110","no","negative"],["46","asympt","118","FALSE","normal","124","no","positive"],["54","asympt","130","FALSE","normal","91","yes","positive"],["48","asympt","160","FALSE","normal","92","yes","positive"],["38","asympt","110","FALSE","normal","150","yes","positive"],["39","atyp_angina","130","FALSE","normal","120","no","negative"],["46","asympt","120","FALSE","normal","115","yes","positive"],["33","non_anginal","120","FALSE","normal","185","no","negative"],["50","asympt","145","FALSE","normal","150","no","positive"],["41","atyp_angina","125","FALSE","normal","144","no","negative"],["49","asympt","140","FALSE","normal","140","yes","positive"],["65","asympt","170","TRUE","normal","112","yes","positive"],["50","atyp_angina","140","FALSE","normal","170","no","negative"],["65","asympt","140","TRUE","normal","87","yes","positive"],["46","typ_angina","140","TRUE","normal","175","no","positive"],["40","non_anginal","140","FALSE","normal","188","no","negative"],["39","atyp_angina","120","FALSE","normal","145","no","negative"],["54","asympt","125","FALSE","normal","140","no","positive"],["48","non_anginal","110","FALSE","normal","138","no","negative"],["55","asympt","140","FALSE","normal","130","yes","positive"],["44","atyp_angina","150","FALSE","normal","150","yes","positive"],["56","non_anginal","130","FALSE","normal","114","no","negative"],["32","atyp_angina","110","FALSE","normal","184","no","negative"],["55","atyp_angina","120","TRUE","normal","137","no","negative"],["54","non_anginal","150","FALSE","normal","122","no","negative"],["51","atyp_angina","125","FALSE","normal","145","no","negative"],["47","atyp_angina","160","FALSE","normal","174","no","negative"],["57","atyp_angina","140","FALSE","st_t_wave_abnormality","145","yes","positive"],["43","atyp_angina","142","FALSE","normal","138","no","negative"],["45","atyp_angina","140","TRUE","normal","122","no","negative"],["53","atyp_angina","140","FALSE","normal","162","no","negative"],["46","non_anginal","120","FALSE","normal","150","no","negative"],["56","non_anginal","130","FALSE","normal","128","yes","negative"],["48","atyp_angina","140","FALSE","normal","118","no","negative"],["55","typ_angina","140","FALSE","?","136","no","positive"],["49","non_anginal","115","FALSE","normal","175","no","positive"],["56","asympt","150","FALSE","st_t_wave_abnormality","124","yes","positive"],["39","atyp_angina","120","FALSE","st_t_wave_abnormality","146","no","negative"],["52","asympt","120","FALSE","normal","150","no","positive"],["53","asympt","130","FALSE","normal","148","no","negative"],["55","non_anginal","120","FALSE","left_vent_hyper","134","no","negative"],["46","asympt","130","FALSE","normal","112","no","positive"],["36","non_anginal","130","FALSE","normal","178","no","negative"],["53","non_anginal","145","FALSE","normal","130","no","positive"],["34","atyp_angina","98","FALSE","normal","150","no","negative"],["31","asympt","120","FALSE","normal","153","yes","positive"],["29","atyp_angina","120","FALSE","normal","160","no","negative"],["46","atyp_angina","140","FALSE","normal","165","yes","negative"],["29","atyp_angina","140","FALSE","normal","170","no","negative"],["43","asympt","150","FALSE","normal","130","yes","positive"],["49","asympt","150","FALSE","normal","122","no","positive"],["39","asympt","110","FALSE","normal","150","no","positive"],["38","asympt","120","FALSE","normal","170","no","positive"],["54","atyp_angina","120","FALSE","normal","154","no","negative"],["40","atyp_angina","130","FALSE","normal","150","no","negative"],["32","asympt","118","FALSE","normal","130","no","positive"],["55","asympt","140","FALSE","normal","110","yes","negative"],["42","atyp_angina","120","FALSE","normal","155","no","negative"],["48","asympt","160","FALSE","normal","103","yes","positive"],["45","asympt","140","FALSE","normal","144","no","negative"],["53","atyp_angina","120","FALSE","normal","132","no","negative"],["39","asympt","110","FALSE","normal","132","no","negative"],["41","asympt","130","FALSE","st_t_wave_abnormality","130","no","positive"],["42","atyp_angina","120","FALSE","normal","150","no","negative"],["49","atyp_angina","100","FALSE","normal","174","no","negative"],["54","atyp_angina","160","FALSE","st_t_wave_abnormality","130","no","negative"],["58","non_anginal","140","FALSE","normal","160","no","negative"],["28","atyp_angina","130","FALSE","left_vent_hyper","185","no","negative"],["46","asympt","110","FALSE","normal","150","yes","positive"],["51","atyp_angina","130","FALSE","normal","150","no","negative"],["48","asympt","160","FALSE","normal","102","yes","positive"],["51","asympt","130","FALSE","normal","100","no","negative"],["42","asympt","140","FALSE","normal","170","no","negative"],["48","asympt","160","FALSE","normal","99","yes","positive"],["32","atyp_angina","125","FALSE","normal","155","no","negative"],["55","non_anginal","110","FALSE","normal","160","no","negative"],["53","asympt","124","FALSE","st_t_wave_abnormality","112","yes","negative"],["46","asympt","180","FALSE","st_t_wave_abnormality","120","no","negative"],["55","atyp_angina","145","FALSE","normal","155","no","negative"],["46","asympt","110","FALSE","st_t_wave_abnormality","140","no","negative"],["49","asympt","128","FALSE","normal","96","yes","positive"],["35","atyp_angina","120","FALSE","left_vent_hyper","180","no","negative"],["35","atyp_angina","110","FALSE","normal","140","no","positive"],["54","non_anginal","120","FALSE","normal","137","no","negative"],["58","atyp_angina","130","FALSE","normal","150","no","negative"],["49","asympt","130","FALSE","normal","120","yes","positive"],["52","atyp_angina","160","FALSE","normal","165","no","negative"],["48","asympt","122","TRUE","st_t_wave_abnormality","150","yes","positive"],["62","atyp_angina","140","FALSE","normal","152","no","negative"],["41","asympt","112","FALSE","normal","142","no","negative"],["52","asympt","160","FALSE","st_t_wave_abnormality","82","yes","positive"],["40","non_anginal","130","FALSE","normal","138","no","negative"],["52","asympt","130","FALSE","normal","120","yes","positive"],["39","asympt","130","FALSE","normal","140","no","negative"],["34","typ_angina","140","FALSE","normal","180","no","positive"],["40","non_anginal","130","FALSE","normal","167","no","negative"],["47","asympt","160","FALSE","st_t_wave_abnormality","158","yes","positive"],["47","asympt","140","TRUE","normal","125","yes","negative"],["56","asympt","120","FALSE","normal","140","no","negative"],["40","atyp_angina","140","FALSE","normal","172","no","negative"],["52","asympt","160","FALSE","normal","94","yes","positive"],["54","atyp_angina","110","FALSE","normal","142","no","negative"],["54","atyp_angina","160","FALSE","normal","175","no","negative"],["53","asympt","120","FALSE","normal","116","yes","positive"],["50","asympt","130","FALSE","normal","121","yes","positive"],["55","asympt","120","FALSE","normal","140","no","negative"],["47","asympt","150","FALSE","normal","98","yes","positive"],["36","non_anginal","112","FALSE","normal","184","no","negative"],["65","asympt","130","FALSE","st_t_wave_abnormality","115","yes","positive"],["37","asympt","140","FALSE","normal","130","yes","positive"],["54","typ_angina","120","FALSE","normal","137","no","negative"],["36","non_anginal","150","FALSE","normal","172","no","negative"],["47","non_anginal","140","FALSE","normal","145","yes","positive"],["36","atyp_angina","120","FALSE","normal","180","no","negative"],["52","asympt","140","FALSE","normal","134","yes","positive"],["41","asympt","110","FALSE","normal","170","no","positive"],["42","non_anginal","120","FALSE","normal","152","yes","negative"],["37","atyp_angina","130","FALSE","st_t_wave_abnormality","98","no","negative"],["58","non_anginal","130","FALSE","st_t_wave_abnormality","140","no","positive"],["50","asympt","150","FALSE","normal","140","yes","negative"],["48","atyp_angina","100","FALSE","normal","100","no","negative"],["58","asympt","135","FALSE","normal","100","no","negative"],["58","atyp_angina","136","FALSE","st_t_wave_abnormality","99","yes","positive"],["44","atyp_angina","120","FALSE","normal","142","no","negative"],["38","non_anginal","145","FALSE","normal","130","no","negative"],["54","atyp_angina","120","FALSE","normal","110","no","negative"],["46","asympt","110","FALSE","st_t_wave_abnormality","140","yes","negative"],["54","non_anginal","120","FALSE","normal","150","yes","positive"],["56","asympt","150","TRUE","normal","125","yes","positive"],["53","non_anginal","120","FALSE","normal","140","no","negative"],["61","asympt","125","FALSE","st_t_wave_abnormality","115","yes","negative"],["49","non_anginal","140","FALSE","normal","172","no","negative"],["50","atyp_angina","170","FALSE","st_t_wave_abnormality","116","no","negative"],["45","non_anginal","135","FALSE","normal","110","no","negative"],["52","asympt","140","FALSE","normal","124","yes","positive"],["50","asympt","140","FALSE","st_t_wave_abnormality","125","yes","positive"],["43","typ_angina","120","FALSE","st_t_wave_abnormality","155","no","positive"],["38","atyp_angina","140","FALSE","normal","150","no","negative"],["53","asympt","180","FALSE","st_t_wave_abnormality","120","yes","positive"],["57","asympt","150","FALSE","normal","92","yes","positive"],["59","atyp_angina","140","FALSE","normal","150","no","negative"],["54","asympt","125","FALSE","normal","122","no","positive"],["39","non_anginal","120","FALSE","normal","170","no","negative"],["50","atyp_angina","120","FALSE","normal","160","no","negative"],["52","atyp_angina","120","FALSE","normal","118","no","negative"],["44","asympt","150","FALSE","normal","170","no","negative"],["36","atyp_angina","120","FALSE","normal","160","no","positive"],["44","atyp_angina","130","FALSE","normal","135","no","negative"],["46","asympt","120","FALSE","normal","125","yes","positive"],["41","asympt","120","FALSE","normal","118","yes","positive"],["45","asympt","120","FALSE","normal","140","no","negative"],["45","asympt","130","FALSE","st_t_wave_abnormality","130","yes","positive"],["52","asympt","130","FALSE","normal","110","yes","positive"],["55","asympt","145","FALSE","normal","96","yes","positive"],["37","non_anginal","130","FALSE","normal","150","no","negative"],["41","atyp_angina","120","FALSE","normal","170","no","negative"],["37","asympt","130","FALSE","normal","158","no","negative"],["44","asympt","130","FALSE","normal","100","yes","positive"],["42","atyp_angina","150","FALSE","normal","136","no","negative"],["41","atyp_angina","120","FALSE","st_t_wave_abnormality","160","no","negative"],["59","asympt","140","FALSE","normal","140","no","negative"],["34","atyp_angina","150","FALSE","st_t_wave_abnormality","168","no","negative"],["52","asympt","170","FALSE","normal","126","yes","positive"],["56","atyp_angina","130","FALSE","normal","100","no","negative"],["38","asympt","92","FALSE","normal","134","yes","positive"],["54","asympt","140","FALSE","normal","105","no","positive"],["48","atyp_angina","130","FALSE","normal","160","no","negative"],["58","asympt","130","FALSE","normal","140","yes","positive"],["54","asympt","130","TRUE","normal","125","yes","positive"],["35","atyp_angina","150","FALSE","normal","168","no","negative"],["58","non_anginal","160","TRUE","st_t_wave_abnormality","92","no","positive"],["55","asympt","140","FALSE","normal","128","yes","positive"],["37","asympt","120","FALSE","normal","168","no","negative"],["54","asympt","150","FALSE","st_t_wave_abnormality","134","no","negative"],["47","typ_angina","110","FALSE","normal","150","no","negative"],["63","asympt","150","FALSE","normal","115","no","positive"],["59","non_anginal","130","FALSE","normal","120","yes","negative"],["52","asympt","112","FALSE","st_t_wave_abnormality","96","yes","positive"],["49","asympt","130","FALSE","normal","170","no","positive"],["53","asympt","140","FALSE","normal","155","no","negative"]]

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../data-mining/algorithms/id3 */ "./data-mining/algorithms/id3/index.js");
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../data-mining/prepareData */ "./data-mining/prepareData.js");
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../data-mining/algorithms/bayes */ "./data-mining/algorithms/bayes/index.js");
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../data-mining/heart_disease_male.csv */ "./data-mining/heart_disease_male.csv");
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3__);





const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: trainData, attributes } = _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1___default()({
	data: (_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3___default()),
	continuosAttributes,
	decisionAttribute: 'disease',
	missingDataValues: ['?', ''],
	positiveDecisionValue: 'positive',
	renameDecisionTo: 'decision',
})

trainData.unshift(attributes.slice())

const id3Classifier = _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0___default()(trainData, continuosAttributes)
const bayesClassifier = _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2___default()(trainData, continuosAttributes)

const form = document.querySelector('form')
const resultEl = document.querySelector('.result')
const resultIcon = resultEl.querySelector('.result-icon')

resultIcon.addEventListener('animationend', () => {
	resultIcon.classList.remove('animate')
})

form.addEventListener('input', () => {
	resultEl.classList.remove('show')
	resultIcon.classList.remove('animate')
})

form.addEventListener('submit', e => {
	e.preventDefault()
	const entries = [...new FormData(form)]
		.filter(([, value]) => value !== '')
		.map(([attr, value]) => {
			if (!continuosAttributes.includes(attr)) return [attr, value]
			return [attr, Number(value)]
		})
	const dataObject = Object.fromEntries(entries)
	console.log(dataObject)

	let result

	if (dataObject.algorithm === 'id3') {
		result = id3Classifier.classify(dataObject)
	} else {
		result = bayesClassifier.classify(dataObject)
	}

	console.log(result)
	const { decision } = result
	resultEl.classList.remove('positive', 'negative')
	resultEl.classList.add('show', ['negative', 'positive'][decision])
	resultIcon.classList.add('animate')
})

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LEdBQUc7QUFDSDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBLFNBQVMsV0FBVztBQUNwQjtBQUNBO0FBQ0E7QUFDQSxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvYmF5ZXMvY3JlYXRlQmF5ZXNDbGFzc2lmaWVyLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2JheWVzL2luZGV4LmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2JheWVzL3V0aWxzLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy9jb25zdHJ1Y3RJZDNUcmVlLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy9jcmVhdGVJZDNDbGFzc2lmaWVyLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy9ncmFwaC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL3V0aWxzLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hcnJheTJkLXV0aWxzL2luZGV4LmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9wcmVwYXJlRGF0YS5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvaGVhcnRfZGlzZWFzZV9tYWxlLmNzdiIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL2NvbXBhdCBnZXQgZGVmYXVsdCBleHBvcnQiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgY2FsY0dhdXNzaWFuRGVuc2l0eSB9ID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIGNyZWF0ZUJheWVzQ2xhc3NpZmllcih7XG5cdGRlY2lzaW9uc0ZyZXFzLFxuXHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcyxcblx0Y29udGludW9zQXR0cmlidXRlc1N0YXRzLFxufSkge1xuXHRjb25zdCBkZWNpc2lvbnNGcmVxc1N1bSA9IGRlY2lzaW9uc0ZyZXFzLnJlZHVjZSgoYWNjLCBmcmVxKSA9PiBhY2MgKyBmcmVxLCAwKVxuXHRjb25zdCBbUDAsIFAxXSA9IGRlY2lzaW9uc0ZyZXFzLm1hcChmcmVxID0+IGZyZXEgLyBkZWNpc2lvbnNGcmVxc1N1bSlcblxuXHRmdW5jdGlvbiBnZXREaXNjcmV0ZUF0dHJzUHJvYnMob2JqZWN0KSB7XG5cdFx0cmV0dXJuIE9iamVjdFxuXHRcdFx0LmVudHJpZXMob2JqZWN0KVxuXHRcdFx0LmZpbHRlcigoW2F0dHIsIHZhbHVlXSkgPT4gKFxuXHRcdFx0XHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcy5oYXMoYXR0cikgJiYgZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMuZ2V0KGF0dHIpLmhhcyh2YWx1ZSlcblx0XHRcdCkpXG5cdFx0XHQucmVkdWNlKFxuXHRcdFx0XHQocHJvYnMsIFthdHRyLCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0XHRwcm9icy5mb3JFYWNoKChfLCBpZHgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGF0dHJGcmVxTWFwID0gZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMuZ2V0KGF0dHIpXG5cdFx0XHRcdFx0XHRjb25zdCBudW1VbmlxdWVWYWx1ZXMgPSBhdHRyRnJlcU1hcC5zaXplXG5cdFx0XHRcdFx0XHRwcm9ic1tpZHhdICo9IChhdHRyRnJlcU1hcC5nZXQodmFsdWUpW2lkeF0gKyAxKSAvIChkZWNpc2lvbnNGcmVxc1tpZHhdICsgbnVtVW5pcXVlVmFsdWVzKVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0cmV0dXJuIHByb2JzXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFsxLCAxXSxcblx0XHRcdClcblx0fVxuXG5cdGZ1bmN0aW9uIGdldENvbnRpbnVvdXNBdHRyc1Byb2JzKG9iamVjdCkge1xuXHRcdHJldHVybiBPYmplY3Rcblx0XHRcdC5lbnRyaWVzKG9iamVjdClcblx0XHRcdC5maWx0ZXIoKFthdHRyXSkgPT4gY29udGludW9zQXR0cmlidXRlc1N0YXRzLmhhcyhhdHRyKSlcblx0XHRcdC5yZWR1Y2UoXG5cdFx0XHRcdChwcm9icywgW2F0dHIsIHZhbHVlXSkgPT4ge1xuXHRcdFx0XHRcdHByb2JzLmZvckVhY2goKF8sIGlkeCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgbXUgPSBjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMuZ2V0KGF0dHIpW2lkeF0uZ2V0KCdtdScpXG5cdFx0XHRcdFx0XHRjb25zdCBzaWdtYSA9IGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cy5nZXQoYXR0cilbaWR4XS5nZXQoJ3NpZ21hJylcblx0XHRcdFx0XHRcdHByb2JzW2lkeF0gKj0gY2FsY0dhdXNzaWFuRGVuc2l0eSh2YWx1ZSwgbXUsIHNpZ21hKVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0cmV0dXJuIHByb2JzXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFsxLCAxXSxcblx0XHRcdClcblx0fVxuXG5cdGZ1bmN0aW9uIGNsYXNzaWZ5KG9iamVjdCkge1xuXHRcdGNvbnN0IGRpc2NyZXRlQXR0cnNQcm9icyA9IGdldERpc2NyZXRlQXR0cnNQcm9icyhvYmplY3QpXG5cdFx0Y29uc3QgY29udGludW91c0F0dHJzUHJvYnMgPSBnZXRDb250aW51b3VzQXR0cnNQcm9icyhvYmplY3QpXG5cblx0XHRjb25zdCBwcm9icyA9IFtkaXNjcmV0ZUF0dHJzUHJvYnMsIGNvbnRpbnVvdXNBdHRyc1Byb2JzXVxuXHRcdFx0LnJlZHVjZSgoYWNjLCBhdHRyUHJvYikgPT4ge1xuXHRcdFx0XHRhY2NbMF0gKj0gYXR0clByb2JbMF1cblx0XHRcdFx0YWNjWzFdICo9IGF0dHJQcm9iWzFdXG5cdFx0XHRcdHJldHVybiBhY2Ncblx0XHRcdH0sIFtQMCwgUDFdKVxuXG5cdFx0Y29uc3QgcHJvYnNTdW0gPSBwcm9icy5yZWR1Y2UoKGFjYywgcCkgPT4gYWNjICsgcCwgMClcblx0XHRwcm9icy5mb3JFYWNoKChfLCBpZHgpID0+IHtcblx0XHRcdHByb2JzW2lkeF0gLz0gcHJvYnNTdW1cblx0XHR9KVxuXHRcdHJldHVybiB7XG5cdFx0XHRkZWNpc2lvbjogcHJvYnNbMF0gPiBwcm9ic1sxXSA/IDAgOiAxLFxuXHRcdFx0MDogcHJvYnNbMF0sXG5cdFx0XHQxOiBwcm9ic1sxXSxcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGNsYXNzaWZ5LFxuXHR9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUJheWVzQ2xhc3NpZmllclxuIiwiY29uc3QgeyB0cmFuc3Bvc2UgfSA9IHJlcXVpcmUoJy4uLy4uL2FycmF5MmQtdXRpbHMnKVxuY29uc3QgY3JlYXRlQmF5ZXNDbGFzc2lmaWVyID0gcmVxdWlyZSgnLi9jcmVhdGVCYXllc0NsYXNzaWZpZXInKVxuXG5mdW5jdGlvbiBjYWxjQXR0cmlidXRlc0ZyZXF1ZW5jaWVzKGFycmF5MmQpIHtcblx0Y29uc3QgZGVjaXNpb25zRnJlcXMgPSBhcnJheTJkLnJlZHVjZShcblx0XHQoYWNjLCByb3cpID0+IHtcblx0XHRcdGFjY1tyb3cuYXQoLTEpXSsrXG5cdFx0XHRyZXR1cm4gYWNjXG5cdFx0fSxcblx0XHRbMCwgMF0sXG5cdClcblxuXHRjb25zdCBhdHRyaWJ1dGVzRnJlcXVlbmNpZXMgPSB0cmFuc3Bvc2UoYXJyYXkyZClcblx0XHQubWFwKChhdHRyUm93LCBfLCB0cmFuc3Bvc2VkQXJyKSA9PiB0cmFuc3Bvc2UoW2F0dHJSb3csIHRyYW5zcG9zZWRBcnIuYXQoLTEpXSkpXG5cdFx0LnNsaWNlKDAsIC0xKVxuXHRcdC5tYXAoYXR0clJvd0FuZERlY2lzaW9uID0+IGF0dHJSb3dBbmREZWNpc2lvbi5yZWR1Y2UoKGF0dHJNYXAsIFthdHRyVmFsdWUsIGRlY2lzaW9uXSkgPT4ge1xuXHRcdFx0aWYgKCFhdHRyTWFwLmhhcyhhdHRyVmFsdWUpKSBhdHRyTWFwLnNldChhdHRyVmFsdWUsIFswLCAwXSlcblx0XHRcdGF0dHJNYXAuZ2V0KGF0dHJWYWx1ZSlbZGVjaXNpb25dKytcblx0XHRcdHJldHVybiBhdHRyTWFwXG5cdFx0fSwgbmV3IE1hcCgpKSlcblxuXHRyZXR1cm4ge1xuXHRcdGF0dHJpYnV0ZXNGcmVxdWVuY2llcyxcblx0XHRkZWNpc2lvbnNGcmVxcyxcblx0fVxufVxuZnVuY3Rpb24gY2FsY0F0dHJpYnV0ZXNNdVNpZ21hMihhcnJheTJkKSB7XG5cdHJldHVybiAoXG5cdFx0dHJhbnNwb3NlKGFycmF5MmQpXG5cdFx0XHQubWFwKGF0dHJSb3cgPT4gYXR0clJvd1xuXHRcdFx0XHQucmVkdWNlKFxuXHRcdFx0XHRcdChhY2MsIHZhbCwgaWR4KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBkZWNpc2lvbiA9IGFycmF5MmRbaWR4XS5hdCgtMSlcblx0XHRcdFx0XHRcdGFjY1tkZWNpc2lvbl0ucHVzaCh2YWwpXG5cdFx0XHRcdFx0XHRyZXR1cm4gYWNjXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRbW10sIFtdXSxcblx0XHRcdFx0KVxuXHRcdFx0XHQubWFwKGdyb3VwZWRBdHRyUm93ID0+IGdyb3VwZWRBdHRyUm93LmZpbHRlcih2YWwgPT4gdmFsICE9PSBudWxsKSlcblx0XHRcdFx0Lm1hcChncm91cGVkQXR0clJvdyA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbiA9IGdyb3VwZWRBdHRyUm93Lmxlbmd0aFxuXHRcdFx0XHRcdGNvbnN0IG11ID0gZ3JvdXBlZEF0dHJSb3cucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjICsgdmFsLCAwKSAvIG5cblx0XHRcdFx0XHRjb25zdCBzaWdtYSA9IChncm91cGVkQXR0clJvdy5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MgKyAodmFsIC0gbXUpICoqIDIsIDApIC8gKG4gLSAxKSkgKiogMC41XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBNYXAoT2JqZWN0LmVudHJpZXMoeyBtdSwgc2lnbWEgfSkpXG5cdFx0XHRcdH0pKVxuXHRcdFx0LnNsaWNlKDAsIC0xKVxuXHQpXG59XG5cbmZ1bmN0aW9uIHRyYWluTmFpdmVCYXllc0NsYXNzaWZpZXIoW2F0dHJOYW1lcywgLi4uZGF0YV0sIGNvbnRpbnVvc0F0dHJpYnV0ZXMgPSBbXSkge1xuXHRjb25zdCBjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlcyA9IGNvbnRpbnVvc0F0dHJpYnV0ZXMubWFwKHZhbHVlID0+IGF0dHJOYW1lcy5maW5kSW5kZXgodiA9PiB2ID09PSB2YWx1ZSkpXG5cblx0Y29uc3QgZGlzY3JldGVBdHRyaWJ1dGVzSW5kZXhlcyA9IGF0dHJOYW1lc1xuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKChfLCBpZHgpID0+IGlkeClcblx0XHQuZmlsdGVyKGlkeCA9PiAhY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMuaW5jbHVkZXMoaWR4KSlcblxuXHRjb25zdCBkYXRhVHJhbnNwb3NlID0gdHJhbnNwb3NlKGRhdGEpXG5cdGNvbnN0IGRlY2lzaW9uQXJyYXkgPSBkYXRhVHJhbnNwb3NlLmF0KC0xKVxuXG5cdGxldCBjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMgPSBjYWxjQXR0cmlidXRlc011U2lnbWEyKFxuXHRcdHRyYW5zcG9zZShbLi4uY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMubWFwKGlkeCA9PiBkYXRhVHJhbnNwb3NlW2lkeF0pLCBkZWNpc2lvbkFycmF5XSksXG5cdClcblxuXHRjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMgPSBuZXcgTWFwKFxuXHRcdGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cy5tYXAoKGF0dHJTdGF0cywgaWR4KSA9PiBbYXR0ck5hbWVzW2NvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzW2lkeF1dLCBhdHRyU3RhdHNdKSxcblx0KVxuXG5cdGNvbnN0IHJlc3VsdCA9IGNhbGNBdHRyaWJ1dGVzRnJlcXVlbmNpZXMoXG5cdFx0dHJhbnNwb3NlKFsuLi5kaXNjcmV0ZUF0dHJpYnV0ZXNJbmRleGVzLm1hcChpZHggPT4gZGF0YVRyYW5zcG9zZVtpZHhdKSwgZGVjaXNpb25BcnJheV0pLFxuXHQpXG5cblx0Y29uc3QgeyBkZWNpc2lvbnNGcmVxcyB9ID0gcmVzdWx0XG5cblx0bGV0IHsgYXR0cmlidXRlc0ZyZXF1ZW5jaWVzOiBkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcyB9ID0gcmVzdWx0XG5cblx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXNcblx0XHQuZmlsdGVyKGF0dHJNYXAgPT4gIWF0dHJNYXAuaGFzKG51bGwpKVxuXHRcdC5mb3JFYWNoKGF0dHJNYXAgPT4ge1xuXHRcdFx0YXR0ck1hcC5kZWxldGUobnVsbClcblx0XHR9KVxuXG5cdGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzID0gbmV3IE1hcChcblx0XHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcy5tYXAoKGF0dHJQcm9icywgaWR4KSA9PiBbYXR0ck5hbWVzW2Rpc2NyZXRlQXR0cmlidXRlc0luZGV4ZXNbaWR4XV0sIGF0dHJQcm9ic10pLFxuXHQpXG5cblx0cmV0dXJuIGNyZWF0ZUJheWVzQ2xhc3NpZmllcih7IGRlY2lzaW9uc0ZyZXFzLCBkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcywgY29udGludW9zQXR0cmlidXRlc1N0YXRzIH0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gdHJhaW5OYWl2ZUJheWVzQ2xhc3NpZmllclxuIiwiZnVuY3Rpb24gY2FsY0dhdXNzaWFuRGVuc2l0eSh4LCBtdSwgc2lnbWEpIHtcblx0cmV0dXJuIE1hdGguZXhwKC0oKHggLSBtdSkgKiogMikgLyAoMiAqIHNpZ21hICoqIDIpKSAvICgoKDIgKiBNYXRoLlBJKSAqKiAwLjUpICogc2lnbWEpXG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBjYWxjR2F1c3NpYW5EZW5zaXR5IH1cbiIsImNvbnN0IHsgY3JlYXRlTm9kZSwgY3JlYXRlTGVhZk5vZGUgfSA9IHJlcXVpcmUoJy4vZ3JhcGgnKVxuY29uc3QgeyBwYXJ0aXRpb24yZEFycmF5LCB0cmFuc3Bvc2UgfSA9IHJlcXVpcmUoJy4uLy4uL2FycmF5MmQtdXRpbHMnKVxuY29uc3QgeyBnZXRBdHRyaWJ1dGVWYWx1ZXNGcmVxdWVuY2llcywgY2FsY01hdHJpeEdhaW5SYXRpbywgY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZSB9ID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIGNhbGNEZWNpc2lvbnNGcmVxdWVuY3koZGF0YSkge1xuXHRyZXR1cm4gZGF0YVxuXHRcdC5tYXAocm93ID0+IHJvdy5hdCgtMSkpXG5cdFx0LnJlZHVjZShcblx0XHRcdChhY2MsIGRlY2lzaW9uKSA9PiB7XG5cdFx0XHRcdGFjY1tkZWNpc2lvbl0rK1xuXHRcdFx0XHRyZXR1cm4gYWNjXG5cdFx0XHR9LFxuXHRcdFx0WzAsIDBdLFxuXHRcdClcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZXhlc09mQ29sdW1uc1dpdGhJZGVudGljYWxWYWx1ZXMoZGF0YSkge1xuXHRyZXR1cm4gdHJhbnNwb3NlKGRhdGEpXG5cdFx0Lm1hcCgocm93LCBpZHgpID0+IFtyb3csIGlkeF0pXG5cdFx0LmZpbHRlcigoW3Jvd10pID0+IG5ldyBTZXQocm93KS5zaXplID09PSAxKVxuXHRcdC5tYXAoKFssIG9yaWdJZHhdKSA9PiBvcmlnSWR4KVxufVxuXG5mdW5jdGlvbiBleGNsdWRlUmVkdW5kYW50QXR0cmlidXRlcyhkYXRhLCBjb2x1bW5OYW1lcykge1xuXHRjb25zdCByZWR1bmRhbnRDb2xJbmRleGVzID0gZ2V0SW5kZXhlc09mQ29sdW1uc1dpdGhJZGVudGljYWxWYWx1ZXMoZGF0YSlcblx0aWYgKCFyZWR1bmRhbnRDb2xJbmRleGVzLmxlbmd0aCkgcmV0dXJuIHsgZGF0YSwgY29sdW1uTmFtZXMgfVxuXG5cdGNvbnN0IGNsZWFuZWREYXRhID0gdHJhbnNwb3NlKHRyYW5zcG9zZShkYXRhKS5maWx0ZXIoKF8sIGlkeCkgPT4gIXJlZHVuZGFudENvbEluZGV4ZXMuaW5jbHVkZXMoaWR4KSkpXG5cdGNvbnN0IGNsZWFuZWRDb2x1bW5OYW1lcyA9IGNvbHVtbk5hbWVzLmZpbHRlcigoXywgaWR4KSA9PiAhcmVkdW5kYW50Q29sSW5kZXhlcy5pbmNsdWRlcyhpZHgpKVxuXG5cdHJldHVybiB7IGRhdGE6IGNsZWFuZWREYXRhLCBjb2x1bW5OYW1lczogY2xlYW5lZENvbHVtbk5hbWVzIH1cbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtQ29udGludW91c0F0dHJpYnV0ZXNUb0Rpc2NyZXRlKGRhdGEsIGNvbHVtbk5hbWVzLCBjb250aW51b3VzQXR0cmlidXRlcykge1xuXHRjb25zdCBjb250aW51b3NJbmRleGVzID0gY29udGludW91c0F0dHJpYnV0ZXNcblx0XHQubWFwKGNvbnRBdHRyID0+IGNvbHVtbk5hbWVzLmZpbmRJbmRleChjb2xOYW1lID0+IGNvbE5hbWUgPT09IGNvbnRBdHRyKSlcblxuXHRjb25zdCBkYXRhVHJhbnNwb3NlID0gdHJhbnNwb3NlKGRhdGEpXG5cblx0Y29uc3QgdGhyZXNob2xkcyA9IGNvbnRpbnVvc0luZGV4ZXNcblx0XHQubWFwKGNvbnRJZHggPT4ge1xuXHRcdFx0Y29uc3QgeyB0aHJlc2hvbGQgfSA9IGNhbGNDb250aW51b3VzVGhyZXNob2xkVmFsdWUoZGF0YVRyYW5zcG9zZVtjb250SWR4XSwgZGF0YVRyYW5zcG9zZS5hdCgtMSkpXG5cdFx0XHRjb25zdCBhdHRyaWJ1dGVOYW1lID0gY29sdW1uTmFtZXNbY29udElkeF1cblx0XHRcdHJldHVybiB7IGF0dHJpYnV0ZU5hbWUsIHRocmVzaG9sZCB9XG5cdFx0fSlcblx0XHQucmVkdWNlKChhY2MsIHsgdGhyZXNob2xkLCBhdHRyaWJ1dGVOYW1lIH0pID0+IHtcblx0XHRcdGFjYy5zZXQoYXR0cmlidXRlTmFtZSwgdGhyZXNob2xkKVxuXHRcdFx0cmV0dXJuIGFjY1xuXHRcdH0sIG5ldyBNYXAoKSlcblxuXHRjb25zdCBkaXNjcmV0ZURhdGEgPSB0cmFuc3Bvc2UoXG5cdFx0ZGF0YVRyYW5zcG9zZS5tYXAoKGF0dHJWYWx1ZXMsIGlkeCkgPT4ge1xuXHRcdFx0aWYgKCFjb250aW51b3NJbmRleGVzLmluY2x1ZGVzKGlkeCkpIHJldHVybiBhdHRyVmFsdWVzXG5cdFx0XHRjb25zdCBhdHRyTmFtZSA9IGNvbHVtbk5hbWVzW2lkeF1cblx0XHRcdHJldHVybiBhdHRyVmFsdWVzLm1hcCh2YWx1ZSA9PiB2YWx1ZSA8PSB0aHJlc2hvbGRzLmdldChhdHRyTmFtZSkpXG5cdFx0fSksXG5cdClcblxuXHRyZXR1cm4geyB0aHJlc2hvbGRzLCBkaXNjcmV0ZURhdGEgfVxufVxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJZDNUcmVlKHsgZGF0YSwgY29sdW1uTmFtZXMsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pIHtcblx0Y29uc3QgZGVjaXNpb25zRnJlcSA9IGNhbGNEZWNpc2lvbnNGcmVxdWVuY3koZGF0YSlcblx0Y29uc3QgbW9zdEZyZXF1ZW50RGVjaXNpb24gPSBkZWNpc2lvbnNGcmVxWzBdID4gZGVjaXNpb25zRnJlcVsxXSA/IDAgOiAxXG5cblx0Y29uc3Qgbm9kZUluZm8gPSB7XG5cdFx0ZGVjaXNpb25zRnJlcXVlbmN5OiBkZWNpc2lvbnNGcmVxLFxuXHRcdG1vc3RGcmVxdWVudERlY2lzaW9uLFxuXHR9XG5cblx0Oyh7IGRhdGEsIGNvbHVtbk5hbWVzIH0gPSBleGNsdWRlUmVkdW5kYW50QXR0cmlidXRlcyhkYXRhLCBjb2x1bW5OYW1lcykpXG5cdGNvbnRpbnVvdXNBdHRyaWJ1dGVzID0gY29udGludW91c0F0dHJpYnV0ZXMuZmlsdGVyKG5hbWUgPT4gY29sdW1uTmFtZXMuaW5jbHVkZXMobmFtZSkpXG5cblx0aWYgKGRlY2lzaW9uc0ZyZXEuc29tZShmcmVxID0+IGZyZXEgPT09IDApIHx8IGRhdGFbMF0ubGVuZ3RoID09PSAxKSB7XG5cdFx0Ly8gYmFzZSBjYXNlczogYWxsIGRlY2lzaW9uIHZhbHVlcyBhcmUgdGhlIHNhbWUsIG9yIHRoZSBkYXRhIGhhcyBubyBhdHRyaWJ1dGVzXG5cdFx0Ly8gcmVtZW1iZXIgJ2V4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzJ1xuXHRcdHJldHVybiBjcmVhdGVMZWFmTm9kZShPYmplY3QuYXNzaWduKG5vZGVJbmZvLCB7IGRlY2lzaW9uOiBtb3N0RnJlcXVlbnREZWNpc2lvbiB9KSlcblx0fVxuXG5cdGNvbnN0IHsgZGlzY3JldGVEYXRhLCB0aHJlc2hvbGRzIH0gPSB0cmFuc2Zvcm1Db250aW51b3VzQXR0cmlidXRlc1RvRGlzY3JldGUoXG5cdFx0ZGF0YSxcblx0XHRjb2x1bW5OYW1lcyxcblx0XHRjb250aW51b3VzQXR0cmlidXRlcyxcblx0KVxuXG5cdGNvbnN0IGF0dHJpYnV0ZXNHYWluUmF0aW8gPSBjYWxjTWF0cml4R2FpblJhdGlvKGRpc2NyZXRlRGF0YSlcblx0Y29uc3QgbWF4R2FpblJhdGlvSWR4ID0gYXR0cmlidXRlc0dhaW5SYXRpby5yZWR1Y2UoXG5cdFx0KGN1ck1heElkeCwgY3VyR2FpblJhdGlvLCBpZHgsIGdhaW5SYXRpb3MpID0+IChjdXJHYWluUmF0aW8gPiBnYWluUmF0aW9zW2N1ck1heElkeF0gPyBpZHggOiBjdXJNYXhJZHgpLFxuXHRcdDAsXG5cdClcblxuXHRPYmplY3QuYXNzaWduKG5vZGVJbmZvLCB7XG5cdFx0Z2FpblJhdGlvOiBhdHRyaWJ1dGVzR2FpblJhdGlvW21heEdhaW5SYXRpb0lkeF0sXG5cdFx0YXR0cmlidXRlOiBjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdLFxuXHR9KVxuXG5cdGlmIChjb250aW51b3VzQXR0cmlidXRlcy5pbmNsdWRlcyhjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdKSkge1xuXHRcdG5vZGVJbmZvLmlzQ29udGludW91cyA9IHRydWVcblx0XHRub2RlSW5mby50aHJlc2hvbGQgPSB0aHJlc2hvbGRzLmdldChjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdKVxuXHR9IGVsc2Uge1xuXHRcdG5vZGVJbmZvLmlzQ29udGludW91cyA9IGZhbHNlXG5cdH1cblxuXHRpZiAoZGlzY3JldGVEYXRhWzBdLmxlbmd0aCA9PT0gMikge1xuXHRcdC8vIGJhc2UgY2FzZXM6IG9ubHkgMSBhdHRyaWJ1dGUgKCsgZGVjaXNpb24pXG5cdFx0Y29uc3Qgbm9kZSA9IGNyZWF0ZU5vZGUobm9kZUluZm8pXG5cblx0XHRjb25zdCBbYXR0clZhbHVlc01hcF0gPSBnZXRBdHRyaWJ1dGVWYWx1ZXNGcmVxdWVuY2llcyhkaXNjcmV0ZURhdGEpXG5cblx0XHRhdHRyVmFsdWVzTWFwLmZvckVhY2goKFtuLCBwXSwgYXR0clZhbHVlKSA9PiB7XG5cdFx0XHRub2RlLmFkZEFkamFjZW50Tm9kZShcblx0XHRcdFx0YXR0clZhbHVlLFxuXHRcdFx0XHRjcmVhdGVMZWFmTm9kZSh7XG5cdFx0XHRcdFx0ZGVjaXNpb25zRnJlcXVlbmN5OiBbbiwgcF0sXG5cdFx0XHRcdFx0bW9zdEZyZXF1ZW50RGVjaXNpb246IG4gPiBwID8gMCA6IDEsXG5cdFx0XHRcdFx0ZGVjaXNpb246IG4gPiBwID8gMCA6IDEsXG5cdFx0XHRcdH0pLFxuXHRcdFx0KVxuXHRcdH0pXG5cblx0XHRyZXR1cm4gbm9kZVxuXHR9XG5cblx0Y29uc3QgY29sdW1uc1RvU2VuZCA9IGNvbHVtbk5hbWVzLmZpbHRlcigoXywgaWR4KSA9PiBpZHggIT09IG1heEdhaW5SYXRpb0lkeClcblxuXHRsZXQgZGF0YVRvUGFydGl0aW9uXG5cdGlmIChub2RlSW5mby5pc0NvbnRpbnVvdXMpIHtcblx0XHRkYXRhVG9QYXJ0aXRpb24gPSB0cmFuc3Bvc2UoZGF0YSlcblx0XHRkYXRhVG9QYXJ0aXRpb25bbWF4R2FpblJhdGlvSWR4XSA9IGRhdGFUb1BhcnRpdGlvblttYXhHYWluUmF0aW9JZHhdLm1hcCh2YWx1ZSA9PiB2YWx1ZSA8PSBub2RlSW5mby50aHJlc2hvbGQpXG5cdFx0ZGF0YVRvUGFydGl0aW9uID0gdHJhbnNwb3NlKGRhdGFUb1BhcnRpdGlvbilcblx0fSBlbHNlIHtcblx0XHRkYXRhVG9QYXJ0aXRpb24gPSBkYXRhXG5cdH1cblxuXHRjb25zdCBub2RlID0gY3JlYXRlTm9kZShub2RlSW5mbylcblxuXHRwYXJ0aXRpb24yZEFycmF5KGRhdGFUb1BhcnRpdGlvbiwgbWF4R2FpblJhdGlvSWR4KS5mb3JFYWNoKChwYXJ0aXRpb25lZERhdGEsIGNvbFZhbHVlTmFtZSkgPT4ge1xuXHRcdG5vZGUuYWRkQWRqYWNlbnROb2RlKFxuXHRcdFx0Y29sVmFsdWVOYW1lLFxuXHRcdFx0Y29uc3RydWN0SWQzVHJlZSh7XG5cdFx0XHRcdGRhdGE6IHBhcnRpdGlvbmVkRGF0YSxcblx0XHRcdFx0Y29sdW1uTmFtZXM6IGNvbHVtbnNUb1NlbmQsXG5cdFx0XHRcdGNvbnRpbnVvdXNBdHRyaWJ1dGVzLFxuXHRcdFx0fSksXG5cdFx0KVxuXHR9KVxuXHRyZXR1cm4gbm9kZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbnN0cnVjdElkM1RyZWVcbiIsImZ1bmN0aW9uIGNyZWF0ZUlkM0NsYXNzaWZpZXIoeyByb290Tm9kZSwgY29udGludW91c0F0dHJpYnV0ZXMgfSkge1xuXHRjb25zdCBub2RlcyA9IGdldEFsbFRyZWVOb2Rlcyhyb290Tm9kZSlcblxuXHRmdW5jdGlvbiBjbGFzc2lmeShvYmplY3QpIHtcblx0XHRsZXQgbm9kZSA9IHJvb3ROb2RlXG5cdFx0Y29uc3QgcGF0aCA9IFtdXG5cdFx0bGV0IGRlY2lzaW9uID0gbnVsbFxuXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IG5vZGVJbmZvID0gbm9kZS5nZXROb2RlSW5mbygpXG5cblx0XHRcdGlmIChub2RlLmlzTGVhZigpKSB7XG5cdFx0XHRcdGRlY2lzaW9uID0gbm9kZUluZm8uZGVjaXNpb25cblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBhdHRyaWJ1dGUgfSA9IG5vZGVJbmZvXG5cdFx0XHRwYXRoLnB1c2goYXR0cmlidXRlKVxuXG5cdFx0XHRpZiAoIShhdHRyaWJ1dGUgaW4gb2JqZWN0KSB8fCBvYmplY3RbYXR0cmlidXRlXSA9PT0gbnVsbCkge1xuXHRcdFx0XHRkZWNpc2lvbiA9IG5vZGVJbmZvLm1vc3RGcmVxdWVudERlY2lzaW9uXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkZ2UgPSBub2RlSW5mby5pc0NvbnRpbnVvdXMgPyBvYmplY3RbYXR0cmlidXRlXSA8PSBub2RlSW5mby50aHJlc2hvbGQgOiBvYmplY3RbYXR0cmlidXRlXVxuXG5cdFx0XHRjb25zdCBhZGphY2VudE5vZGVzID0gbm9kZS5nZXRBZGphY2VudE5vZGVzKClcblx0XHRcdGlmICghYWRqYWNlbnROb2Rlcy5oYXMoZWRnZSkpIHtcblx0XHRcdFx0ZGVjaXNpb24gPSBub2RlSW5mby5tb3N0RnJlcXVlbnREZWNpc2lvblxuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gYWRqYWNlbnROb2Rlcy5nZXQoZWRnZSlcblx0XHR9XG5cblx0XHRyZXR1cm4geyBkZWNpc2lvbiwgcGF0aCB9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRSb290Tm9kZSgpIHtcblx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSh7IC4uLnJvb3ROb2RlIH0pXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRBbGxUcmVlTm9kZXMocm9vdCkge1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXAoKVxuXG5cdFx0Y29uc3QgcSA9IFtyb290XVxuXG5cdFx0Zm9yIChsZXQgbGVuID0gcS5sZW5ndGg7IGxlbiA+IDA7IGxlbiA9IHEubGVuZ3RoKSB7XG5cdFx0XHR3aGlsZSAobGVuLS0pIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHEuc2hpZnQoKVxuXHRcdFx0XHRtYXAuc2V0KG5vZGUuZ2V0SWQoKSwgbm9kZSlcblx0XHRcdFx0aWYgKG5vZGUuaXNMZWFmKCkpIGNvbnRpbnVlXG5cdFx0XHRcdG5vZGUuZ2V0QWRqYWNlbnROb2RlcygpLmZvckVhY2goYWRqTm9kZSA9PiBxLnB1c2goYWRqTm9kZSkpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hcFxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VHJlZU5vZGVzKCkge1xuXHRcdHJldHVybiBub2Rlc1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjbGFzc2lmeSxcblx0XHRnZXRUcmVlTm9kZXMsXG5cdFx0Z2V0Um9vdE5vZGUsXG5cdH1cbn1cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlSWQzQ2xhc3NpZmllclxuIiwibGV0IGlkeCA9IDBcblxuZnVuY3Rpb24gY3JlYXRlTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0Y29uc3QgYWRqYWNlbnROb2RlcyA9IG5ldyBNYXAoKVxuXG5cdGZ1bmN0aW9uIGdldE5vZGVJbmZvKCkge1xuXHRcdHJldHVybiBub2RlSW5mb1xuXHR9XG5cblx0ZnVuY3Rpb24gYWRkQWRqYWNlbnROb2RlKGVkZ2UsIG5vZGUpIHtcblx0XHRhZGphY2VudE5vZGVzLnNldChlZGdlLCBub2RlKVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0QWRqYWNlbnROb2RlcygpIHtcblx0XHRyZXR1cm4gbmV3IE1hcChhZGphY2VudE5vZGVzKVxuXHR9XG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0SWQoKSB7XG5cdFx0cmV0dXJuIGlkXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldElkLFxuXHRcdGlzTGVhZixcblx0XHRhZGRBZGphY2VudE5vZGUsXG5cdFx0Z2V0QWRqYWNlbnROb2Rlcyxcblx0XHRnZXROb2RlSW5mbyxcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVMZWFmTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiB0cnVlXG5cdH1cblx0ZnVuY3Rpb24gZ2V0Tm9kZUluZm8oKSB7XG5cdFx0cmV0dXJuIG5vZGVJbmZvXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJZCgpIHtcblx0XHRyZXR1cm4gaWRcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0SWQsXG5cdFx0aXNMZWFmLFxuXHRcdGdldE5vZGVJbmZvLFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjcmVhdGVOb2RlLFxuXHRjcmVhdGVMZWFmTm9kZSxcbn1cbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IHsgZmlsbE1pc3NpbmdWYWx1ZXMgfSA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuY29uc3QgY3JlYXRlQ2xhc3NpZmllciA9IHJlcXVpcmUoJy4vY3JlYXRlSWQzQ2xhc3NpZmllcicpXG5jb25zdCBjb25zdHJ1Y3RJZDNUcmVlID0gcmVxdWlyZSgnLi9jb25zdHJ1Y3RJZDNUcmVlJylcblxuZnVuY3Rpb24gdHJhaW5JZDNDbGFzc2lmaWVyKFtjb2x1bW5OYW1lcywgLi4uZGF0YV0sIGNvbnRpbnVvdXNBdHRyaWJ1dGVzID0gW10pIHtcblx0ZGF0YSA9IHRyYW5zcG9zZShcblx0XHR0cmFuc3Bvc2UoZGF0YSlcblx0XHRcdC5tYXAoKGF0dHJSb3csIGlkeCwgdHJhbnNwb3NlZCkgPT4ge1xuXHRcdFx0XHRpZiAoaWR4ID09PSB0cmFuc3Bvc2VkLmxlbmd0aCAtIDEpIHJldHVybiBhdHRyUm93XG5cdFx0XHRcdHJldHVybiBmaWxsTWlzc2luZ1ZhbHVlcyhhdHRyUm93KVxuXHRcdFx0fSksXG5cdClcblxuXHRjb25zdCByb290Tm9kZSA9IGNvbnN0cnVjdElkM1RyZWUoeyBkYXRhLCBjb2x1bW5OYW1lcywgY29udGludW91c0F0dHJpYnV0ZXMgfSlcblxuXHRyZXR1cm4gY3JlYXRlQ2xhc3NpZmllcih7IHJvb3ROb2RlLCBjb250aW51b3VzQXR0cmlidXRlcyB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYWluSWQzQ2xhc3NpZmllclxuIiwiY29uc3QgeyB0cmFuc3Bvc2UgfSA9IHJlcXVpcmUoJy4uLy4uL2FycmF5MmQtdXRpbHMnKVxuXG5mdW5jdGlvbiBmaWxsTWlzc2luZ1ZhbHVlcyhhcnJheSkge1xuXHRjb25zdCBmcmVxTWFwID0gbmV3IE1hcCgpXG5cblx0YXJyYXlcblx0XHQuZmlsdGVyKHZhbHVlID0+IHZhbHVlICE9PSBudWxsKVxuXHRcdC5mb3JFYWNoKHZhbHVlID0+IHtcblx0XHRcdGNvbnN0IHByZUZyZXEgPSBmcmVxTWFwLmhhcyh2YWx1ZSkgPyBmcmVxTWFwLmdldCh2YWx1ZSkgOiAwXG5cdFx0XHRmcmVxTWFwLnNldCh2YWx1ZSwgcHJlRnJlcSArIDEpXG5cdFx0fSlcblxuXHRjb25zdCBmcmVxQXJyYXkgPSBbLi4uZnJlcU1hcC5lbnRyaWVzKCldXG5cblx0Y29uc3QgbnVtTm9uTWlzc2luZ1ZhbHVlcyA9IGZyZXFBcnJheS5yZWR1Y2UoKGFjYywgWywgZnJlcV0pID0+IGFjYyArIGZyZXEsIDApXG5cblx0Y29uc3QgcHJvYkFycmF5ID0gWy4uLmZyZXFBcnJheV1cblx0XHQuc29ydCgoWywgZnJlcTFdLCBbLCBmcmVxMl0pID0+IGZyZXExIC0gZnJlcTIpXG5cdFx0Lm1hcCgoW3ZhbHVlLCBmcmVxXSkgPT4gW3ZhbHVlLCBmcmVxIC8gbnVtTm9uTWlzc2luZ1ZhbHVlc10pXG5cblx0cHJvYkFycmF5LmZvckVhY2goKF8sIGlkeCkgPT4ge1xuXHRcdHByb2JBcnJheVtpZHhdWzFdICs9IGlkeCA9PT0gMCA/IDAgOiBwcm9iQXJyYXlbaWR4IC0gMV1bMV1cblx0fSlcblxuXHRyZXR1cm4gYXJyYXkubWFwKHZhbHVlID0+IHtcblx0XHRpZiAodmFsdWUgIT09IG51bGwpIHJldHVybiB2YWx1ZVxuXHRcdGNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbSgpXG5cdFx0cmV0dXJuIHByb2JBcnJheS5maW5kKChbLCBwcm9iXSkgPT4gcmFuZCA8PSBwcm9iKVswXVxuXHR9KVxufVxuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVWYWx1ZXNGcmVxdWVuY2llcyhhcnJheTJkKSB7XG5cdC8qXG5cdFtcblx0XHR7YXR0cjFWMTogW24sIHBdLCBhdHRyMVYyOiBbbiwgcF0sIGF0dHIxVjM6IFtuLCBwXX0sXG5cdFx0e2F0dHIyVjE6IFtuLCBwXSwgYXR0cjJWMjogW24sIHBdLCBhdHRyMlYzOiBbbiwgcF19LFxuXHRcdC4uXG5cdF1cblx0Ki9cblx0cmV0dXJuIHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdC5tYXAoKGF0dHJSb3csIF8sIHRyYW5zcG9zZWRBcnIpID0+IFthdHRyUm93LCB0cmFuc3Bvc2VkQXJyLmF0KC0xKV0pXG5cdFx0Lm1hcCh0cmFuc3Bvc2UpXG5cdFx0Lm1hcChhdHRyRGVjaXNpb24gPT4gYXR0ckRlY2lzaW9uLnJlZHVjZSgobWFwLCBbYXR0clZhbCwgZGVjaXNpb25dKSA9PiB7XG5cdFx0XHRpZiAoIW1hcC5oYXMoYXR0clZhbCkpIG1hcC5zZXQoYXR0clZhbCwgWzAsIDBdKVxuXHRcdFx0bWFwLmdldChhdHRyVmFsKVtkZWNpc2lvbl0rK1xuXHRcdFx0cmV0dXJuIG1hcFxuXHRcdH0sIG5ldyBNYXAoKSkpXG59XG5cbmZ1bmN0aW9uIGNhbGNFbnRyb3B5KGFycmF5KSB7XG5cdGNvbnN0IHN1bSA9IGFycmF5LnJlZHVjZSgoYWNjLCB2KSA9PiBhY2MgKyB2LCAwKVxuXHRyZXR1cm4gLWFycmF5LnJlZHVjZSgoYWNjLCB2KSA9PiAoYWNjICsgKHYgPT09IDAgPyAwIDogKHYgLyBzdW0pICogTWF0aC5sb2cyKHYgLyBzdW0pKSksIDApXG59XG5cbmZ1bmN0aW9uIGNhbGNNYXRyaXhHYWluUmF0aW8oYXJyYXkyZCkge1xuXHRjb25zdCBudW1TYW1wbGVzID0gYXJyYXkyZC5sZW5ndGhcblxuXHRjb25zdCBhdHRyaWJ1dGVWYWx1ZXNGcmVxcyA9IGdldEF0dHJpYnV0ZVZhbHVlc0ZyZXF1ZW5jaWVzKGFycmF5MmQpXG5cblx0Y29uc3QgZGF0YUVudHJvcHkgPSBjYWxjRW50cm9weShbXG5cdFx0YXR0cmlidXRlVmFsdWVzRnJlcXMuYXQoLTEpLmdldCgwKVswXSxcblx0XHRhdHRyaWJ1dGVWYWx1ZXNGcmVxcy5hdCgtMSkuZ2V0KDEpWzFdLFxuXHRdKVxuXG5cdGNvbnN0IGluZm9FbnRyb3BpZXMgPSBhdHRyaWJ1dGVWYWx1ZXNGcmVxc1xuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKGF0dHJNYXAgPT4gKFxuXHRcdFx0Wy4uLmF0dHJNYXAudmFsdWVzKCldLnJlZHVjZSgoYWNjLCBbbiwgcF0pID0+IGFjYyArIChjYWxjRW50cm9weShbbiwgcF0pICogKG4gKyBwKSkgLyBudW1TYW1wbGVzLCAwKVxuXHRcdCkpXG5cblx0Y29uc3QgaW5mb0dhaW5zID0gaW5mb0VudHJvcGllcy5tYXAoaWUgPT4gZGF0YUVudHJvcHkgLSBpZSlcblxuXHRjb25zdCBzcGxpdEluZm9zID0gYXR0cmlidXRlVmFsdWVzRnJlcXNcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcChhdHRyTWFwID0+IFsuLi5hdHRyTWFwLnZhbHVlcygpXS5tYXAoKFtuLCBwXSkgPT4gbiArIHApKVxuXHRcdC5tYXAoYXR0clZhbHVlc0NudEFycmF5ID0+IGNhbGNFbnRyb3B5KGF0dHJWYWx1ZXNDbnRBcnJheSkpXG5cblx0cmV0dXJuIGluZm9HYWlucy5tYXAoKGcsIGlkeCkgPT4gZyAvIHNwbGl0SW5mb3NbaWR4XSlcbn1cblxuZnVuY3Rpb24gY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZSh2YWx1ZXNBcnJheSwgZGVjaXNpb25zKSB7XG5cdGNvbnN0IHNvcnRlZFVuaXF1ZVZhbHVlcyA9IFsuLi5uZXcgU2V0KHZhbHVlc0FycmF5KV0uc29ydCgoYSwgYikgPT4gYSAtIGIpXG5cblx0Y29uc29sZS5hc3NlcnQoc29ydGVkVW5pcXVlVmFsdWVzLmxlbmd0aCA+PSAyKVxuXG5cdHJldHVybiBzb3J0ZWRVbmlxdWVWYWx1ZXNcblx0XHQucmVkdWNlKChiZXN0LCBfLCBpZHgpID0+IHtcblx0XHRcdGlmIChpZHggPT09IDApIHJldHVybiBudWxsXG5cblx0XHRcdGNvbnN0IHRocmVzaG9sZCA9IChzb3J0ZWRVbmlxdWVWYWx1ZXNbaWR4XSArIHNvcnRlZFVuaXF1ZVZhbHVlc1tpZHggLSAxXSkgLyAyXG5cdFx0XHRjb25zdCBbZ2FpblJhdGlvXSA9IGNhbGNNYXRyaXhHYWluUmF0aW8oXG5cdFx0XHRcdHRyYW5zcG9zZShbdmFsdWVzQXJyYXkubWFwKHZhbHVlID0+IHZhbHVlIDw9IHRocmVzaG9sZCksIGRlY2lzaW9uc10pLFxuXHRcdFx0KVxuXG5cdFx0XHRpZiAoYmVzdCA9PT0gbnVsbCB8fCBnYWluUmF0aW8gPiBiZXN0LmdhaW5SYXRpbykgcmV0dXJuIHsgdGhyZXNob2xkLCBnYWluUmF0aW8gfVxuXG5cdFx0XHRyZXR1cm4gYmVzdFxuXHRcdH0sIG51bGwpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjYWxjQ29udGludW91c1RocmVzaG9sZFZhbHVlLFxuXHRjYWxjRW50cm9weSxcblx0Y2FsY01hdHJpeEdhaW5SYXRpbyxcblx0ZmlsbE1pc3NpbmdWYWx1ZXMsXG5cdGdldEF0dHJpYnV0ZVZhbHVlc0ZyZXF1ZW5jaWVzLFxufVxuIiwiZnVuY3Rpb24gcGFydGl0aW9uMmRBcnJheShhcnJheTJkLCBjb2x1bW5JZHgpIHtcblx0Y29uc3QgbnVtQ29sdW1ucyA9IGFycmF5MmRbMF0ubGVuZ3RoXG5cdGNvbHVtbklkeCA9ICgoY29sdW1uSWR4ICUgbnVtQ29sdW1ucykgKyBudW1Db2x1bW5zKSAlIG51bUNvbHVtbnNcblxuXHRyZXR1cm4gYXJyYXkyZC5yZWR1Y2UoKHBhcnRzLCByb3cpID0+IHtcblx0XHRjb25zdCB0YXJnZXRDb2x1bW5WYWx1ZSA9IHJvd1tjb2x1bW5JZHhdXG5cblx0XHRpZiAoIXBhcnRzLmhhcyh0YXJnZXRDb2x1bW5WYWx1ZSkpIHBhcnRzLnNldCh0YXJnZXRDb2x1bW5WYWx1ZSwgW10pXG5cblx0XHRwYXJ0cy5nZXQodGFyZ2V0Q29sdW1uVmFsdWUpLnB1c2goWy4uLnJvdy5zbGljZSgwLCBjb2x1bW5JZHgpLCAuLi5yb3cuc2xpY2UoY29sdW1uSWR4ICsgMSldKVxuXG5cdFx0cmV0dXJuIHBhcnRzXG5cdH0sIG5ldyBNYXAoKSlcbn1cblxuZnVuY3Rpb24gdHJhbnNwb3NlKGFycmF5KSB7XG5cdGNvbnN0IHJvd3MgPSBhcnJheS5sZW5ndGhcblxuXHRpZiAocm93cyA9PT0gMCkgcmV0dXJuIFtdXG5cblx0Y29uc3QgY29scyA9IGFycmF5WzBdLmxlbmd0aFxuXG5cdGlmIChjb2xzID09PSB1bmRlZmluZWQpIHJldHVybiB0cmFuc3Bvc2UoW2FycmF5XSlcblxuXHRjb25zdCByZXQgPSBuZXcgQXJyYXkoY29scykuZmlsbChudWxsKS5tYXAoKCkgPT4gbmV3IEFycmF5KHJvd3MpLmZpbGwobnVsbCkpXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCByb3dzOyBpKyspIHtcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGNvbHM7IGorKykge1xuXHRcdFx0cmV0W2pdW2ldID0gYXJyYXlbaV1bal1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmV0XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRwYXJ0aXRpb24yZEFycmF5LFxuXHR0cmFuc3Bvc2UsXG59XG4iLCJmdW5jdGlvbiBtb3ZlRGVjaXNpb25BdHRyaWJ1dGVUb0xhc3RDb2x1bW4oZGF0YSwgYXR0cmlidXRlcywgZGVjaXNpb25BdHRyaWJ1dGUpIHtcblx0Y29uc3QgaiA9IGF0dHJpYnV0ZXMuZmluZEluZGV4KGF0dHIgPT4gYXR0ciA9PT0gZGVjaXNpb25BdHRyaWJ1dGUpXG5cblx0Y29uc3QgbiA9IGF0dHJpYnV0ZXMubGVuZ3RoXG5cblx0aWYgKGogPT09IG4gLSAxKSByZXR1cm4geyBkYXRhLCBhdHRyaWJ1dGVzIH1cblxuXHRkYXRhID0gWy4uLmRhdGFdXG5cdGF0dHJpYnV0ZXMgPSBbLi4uZGF0YV1cblxuXHQ7W2RhdGFbal0sIGRhdGFbbiAtIDFdXSA9IFtkYXRhW24gLSAxXSwgZGF0YVtqXV1cblx0O1thdHRyaWJ1dGVzW2pdLCBhdHRyaWJ1dGVzW24gLSAxXV0gPSBbYXR0cmlidXRlc1tuIC0gMV0sIGF0dHJpYnV0ZXNbal1dXG5cblx0cmV0dXJuIHsgZGF0YSwgYXR0cmlidXRlcyB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VNaXNzaW5nRGF0YShkYXRhLCBtaXNzaW5nRGF0YVZhbHVlcykge1xuXHRyZXR1cm4gZGF0YS5tYXAocm93ID0+IHJvdy5tYXAodmFsdWUgPT4gKG1pc3NpbmdEYXRhVmFsdWVzLmluY2x1ZGVzKHZhbHVlKSA/IG51bGwgOiB2YWx1ZSkpKVxufVxuXG5mdW5jdGlvbiBjYXN0Q29sdW1uc1RvTnVtYmVyKGRhdGEsIGNvbHVtbkluZGV4ZXMpIHtcblx0cmV0dXJuIGRhdGEubWFwKHJvdyA9PiB7XG5cdFx0cm93ID0gWy4uLnJvd11cblx0XHRjb2x1bW5JbmRleGVzLmZvckVhY2goY29sSWR4ID0+IHtcblx0XHRcdHJvd1tjb2xJZHhdID0gTnVtYmVyKHJvd1tjb2xJZHhdKVxuXHRcdH0pXG5cdFx0cmV0dXJuIHJvd1xuXHR9KVxufVxuXG5mdW5jdGlvbiByZXBsYWNlRGVjaXNpb25BdHRyaWJ1dGVzV2l0aDAoZGF0YSwgcG9zaXRpdmVWYWx1ZXMpIHtcblx0cmV0dXJuIGRhdGEubWFwKHJvdyA9PiB7XG5cdFx0cm93ID0gWy4uLnJvd11cblx0XHRjb25zdCB2YWx1ZSA9IHJvd1tyb3cubGVuZ3RoIC0gMV1cblx0XHRyb3dbcm93Lmxlbmd0aCAtIDFdID0gdmFsdWUgPT09IHBvc2l0aXZlVmFsdWVzID8gMSA6IDBcblx0XHRyZXR1cm4gcm93XG5cdH0pXG59XG5cbmZ1bmN0aW9uIHByZXBhcmVEYXRhKHtcblx0ZGF0YTogb3JpZ0RhdGEsXG5cdGRlY2lzaW9uQXR0cmlidXRlLFxuXHRtaXNzaW5nRGF0YVZhbHVlcyxcblx0Y29udGludW9zQXR0cmlidXRlcyxcblx0cG9zaXRpdmVEZWNpc2lvblZhbHVlLFxuXHRyZW5hbWVEZWNpc2lvblRvID0gbnVsbCxcbn0pIHtcblx0bGV0IGF0dHJpYnV0ZXMgPSBvcmlnRGF0YVswXVxuXHRsZXQgZGF0YSA9IG9yaWdEYXRhLnNsaWNlKDEpXG5cblx0Oyh7IGRhdGEsIGF0dHJpYnV0ZXMgfSA9IG1vdmVEZWNpc2lvbkF0dHJpYnV0ZVRvTGFzdENvbHVtbihkYXRhLCBhdHRyaWJ1dGVzLCBkZWNpc2lvbkF0dHJpYnV0ZSkpXG5cdGRhdGEgPSByZXBsYWNlTWlzc2luZ0RhdGEoZGF0YSwgbWlzc2luZ0RhdGFWYWx1ZXMpXG5cblx0Y29uc3QgY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMgPSBjb250aW51b3NBdHRyaWJ1dGVzLm1hcChhdHRyID0+IGF0dHJpYnV0ZXMuZmluZEluZGV4KHYgPT4gdiA9PT0gYXR0cikpXG5cdGRhdGEgPSBjYXN0Q29sdW1uc1RvTnVtYmVyKGRhdGEsIGNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzKVxuXG5cdGRhdGEgPSByZXBsYWNlRGVjaXNpb25BdHRyaWJ1dGVzV2l0aDAoZGF0YSwgcG9zaXRpdmVEZWNpc2lvblZhbHVlKVxuXG5cdGlmIChyZW5hbWVEZWNpc2lvblRvKSBhdHRyaWJ1dGVzW2F0dHJpYnV0ZXMubGVuZ3RoIC0gMV0gPSByZW5hbWVEZWNpc2lvblRvXG5cblx0cmV0dXJuIHsgZGF0YSwgYXR0cmlidXRlcyB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJlcGFyZURhdGFcbiIsIm1vZHVsZS5leHBvcnRzID0gW1tcImFnZVwiLFwiY2hlc3RfcGFpbl90eXBlXCIsXCJyZXN0X2Jsb29kX3ByZXNzdXJlXCIsXCJibG9vZF9zdWdhclwiLFwicmVzdF9lbGVjdHJvXCIsXCJtYXhfaGVhcnRfcmF0ZVwiLFwiZXhlcmNpY2VfYW5naW5hXCIsXCJkaXNlYXNlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMzlcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDJcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIlRSVUVcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTE5XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjIwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTcwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTJcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjYwXCIsXCJhc3ltcHRcIixcIjEwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTQzXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY2XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNjBcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjEzNVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxMDZcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxOTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwNlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY2XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTU1XCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXN5bXB0XCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MVwiLFwibm9uX2FuZ2luYWxcIixcIjEzNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTlcIixcIm5vbl9hbmdpbmFsXCIsXCIxODBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMThcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTFcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5MlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzNcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDFcIixcImF0eXBfYW5naW5hXCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjE3MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMTJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTBcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCI4N1wiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NlwiLFwidHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE3NVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwibm9uX2FuZ2luYWxcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDRcIixcImF0eXBfYW5naW5hXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzJcIixcImF0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJub25fYW5naW5hbFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDNcIixcImF0eXBfYW5naW5hXCIsXCIxNDJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyOFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcInR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIj9cIixcIjEzNlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ5XCIsXCJub25fYW5naW5hbFwiLFwiMTE1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQ2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxMzRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM2XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwibm9uX2FuZ2luYWxcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzRcIixcImF0eXBfYW5naW5hXCIsXCI5OFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzFcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTNcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMjlcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjVcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMjlcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIyXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzJcIixcImFzeW1wdFwiLFwiMTE4XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDNcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzlcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzMFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXR5cF9hbmdpbmFcIixcIjEwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIyOFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTg1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTFcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUxXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDJcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk5XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjMyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwibm9uX2FuZ2luYWxcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTI0XCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMTJcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTgwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxMjhcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxODBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNVwiLFwiYXR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTIyXCIsXCJUUlVFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI2MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDFcIixcImFzeW1wdFwiLFwiMTEyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjgyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM0XCIsXCJ0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjdcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1OFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0N1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDBcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOThcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMTJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM3XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJ0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM2XCIsXCJub25fYW5naW5hbFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTJcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMzdcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjk4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTAwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXN5bXB0XCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTM2XCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI5OVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzhcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTNcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjYxXCIsXCJhc3ltcHRcIixcIjEyNVwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE1XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXR5cF9hbmdpbmFcIixcIjE3MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDVcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTI1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQzXCIsXCJ0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1NVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxODBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1N1wiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjkyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ0XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzZcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ1XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzdcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzN1wiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ0XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTlcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNFwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTY4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTcwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjkyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNVwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIlRSVUVcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOTJcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyOFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzN1wiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTM0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcInR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjNcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1OVwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjExMlwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdXSIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuX193ZWJwYWNrX3JlcXVpcmVfXy5uID0gKG1vZHVsZSkgPT4ge1xuXHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cblx0XHQoKSA9PiAobW9kdWxlWydkZWZhdWx0J10pIDpcblx0XHQoKSA9PiAobW9kdWxlKTtcblx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgeyBhOiBnZXR0ZXIgfSk7XG5cdHJldHVybiBnZXR0ZXI7XG59OyIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgY3JlYXRlSWQzQ2xhc3NpZmllciBmcm9tICcuLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMydcbmltcG9ydCBwcmVwYXJlRGF0YSBmcm9tICcuLi9kYXRhLW1pbmluZy9wcmVwYXJlRGF0YSdcbmltcG9ydCBjcmVhdGVCYXllc0NsYXNzaWZpZXIgZnJvbSAnLi4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcydcbmltcG9ydCBkYXRhc2V0IGZyb20gJy4uL2RhdGEtbWluaW5nL2hlYXJ0X2Rpc2Vhc2VfbWFsZS5jc3YnXG5cbmNvbnN0IGNvbnRpbnVvc0F0dHJpYnV0ZXMgPSBbJ2FnZScsICdyZXN0X2Jsb29kX3ByZXNzdXJlJywgJ21heF9oZWFydF9yYXRlJ11cblxuY29uc3QgeyBkYXRhOiB0cmFpbkRhdGEsIGF0dHJpYnV0ZXMgfSA9IHByZXBhcmVEYXRhKHtcblx0ZGF0YTogZGF0YXNldCxcblx0Y29udGludW9zQXR0cmlidXRlcyxcblx0ZGVjaXNpb25BdHRyaWJ1dGU6ICdkaXNlYXNlJyxcblx0bWlzc2luZ0RhdGFWYWx1ZXM6IFsnPycsICcnXSxcblx0cG9zaXRpdmVEZWNpc2lvblZhbHVlOiAncG9zaXRpdmUnLFxuXHRyZW5hbWVEZWNpc2lvblRvOiAnZGVjaXNpb24nLFxufSlcblxudHJhaW5EYXRhLnVuc2hpZnQoYXR0cmlidXRlcy5zbGljZSgpKVxuXG5jb25zdCBpZDNDbGFzc2lmaWVyID0gY3JlYXRlSWQzQ2xhc3NpZmllcih0cmFpbkRhdGEsIGNvbnRpbnVvc0F0dHJpYnV0ZXMpXG5jb25zdCBiYXllc0NsYXNzaWZpZXIgPSBjcmVhdGVCYXllc0NsYXNzaWZpZXIodHJhaW5EYXRhLCBjb250aW51b3NBdHRyaWJ1dGVzKVxuXG5jb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZm9ybScpXG5jb25zdCByZXN1bHRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5yZXN1bHQnKVxuY29uc3QgcmVzdWx0SWNvbiA9IHJlc3VsdEVsLnF1ZXJ5U2VsZWN0b3IoJy5yZXN1bHQtaWNvbicpXG5cbnJlc3VsdEljb24uYWRkRXZlbnRMaXN0ZW5lcignYW5pbWF0aW9uZW5kJywgKCkgPT4ge1xuXHRyZXN1bHRJY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2FuaW1hdGUnKVxufSlcblxuZm9ybS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcblx0cmVzdWx0RWwuY2xhc3NMaXN0LnJlbW92ZSgnc2hvdycpXG5cdHJlc3VsdEljb24uY2xhc3NMaXN0LnJlbW92ZSgnYW5pbWF0ZScpXG59KVxuXG5mb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGUgPT4ge1xuXHRlLnByZXZlbnREZWZhdWx0KClcblx0Y29uc3QgZW50cmllcyA9IFsuLi5uZXcgRm9ybURhdGEoZm9ybSldXG5cdFx0LmZpbHRlcigoWywgdmFsdWVdKSA9PiB2YWx1ZSAhPT0gJycpXG5cdFx0Lm1hcCgoW2F0dHIsIHZhbHVlXSkgPT4ge1xuXHRcdFx0aWYgKCFjb250aW51b3NBdHRyaWJ1dGVzLmluY2x1ZGVzKGF0dHIpKSByZXR1cm4gW2F0dHIsIHZhbHVlXVxuXHRcdFx0cmV0dXJuIFthdHRyLCBOdW1iZXIodmFsdWUpXVxuXHRcdH0pXG5cdGNvbnN0IGRhdGFPYmplY3QgPSBPYmplY3QuZnJvbUVudHJpZXMoZW50cmllcylcblx0Y29uc29sZS5sb2coZGF0YU9iamVjdClcblxuXHRsZXQgcmVzdWx0XG5cblx0aWYgKGRhdGFPYmplY3QuYWxnb3JpdGhtID09PSAnaWQzJykge1xuXHRcdHJlc3VsdCA9IGlkM0NsYXNzaWZpZXIuY2xhc3NpZnkoZGF0YU9iamVjdClcblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSBiYXllc0NsYXNzaWZpZXIuY2xhc3NpZnkoZGF0YU9iamVjdClcblx0fVxuXG5cdGNvbnNvbGUubG9nKHJlc3VsdClcblx0Y29uc3QgeyBkZWNpc2lvbiB9ID0gcmVzdWx0XG5cdHJlc3VsdEVsLmNsYXNzTGlzdC5yZW1vdmUoJ3Bvc2l0aXZlJywgJ25lZ2F0aXZlJylcblx0cmVzdWx0RWwuY2xhc3NMaXN0LmFkZCgnc2hvdycsIFsnbmVnYXRpdmUnLCAncG9zaXRpdmUnXVtkZWNpc2lvbl0pXG5cdHJlc3VsdEljb24uY2xhc3NMaXN0LmFkZCgnYW5pbWF0ZScpXG59KVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9