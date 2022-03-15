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
		.filter(attrMap => attrMap.has(null))
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
const { calcMatrixGainRatio, calcContinuousThresholdValue, fillMissingValues } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")

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

	function objectHasValidAttributeValue(object, attribute, node) {
		if (!(attribute in object)) return false

		const nodeInfo = node.getNodeInfo()
		const adjacentNodes = node.getAdjacentNodes()
		const attributeValue = object[attribute]

		if (nodeInfo.isContinuous) return Number.isFinite(attributeValue)
		return adjacentNodes.has(attributeValue)
	}

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

			let edge

			if (!objectHasValidAttributeValue(object, attribute, node)) {
				edge = nodeInfo.mostFrequentAttributeValue
			} else {
				edge = nodeInfo.isContinuous ? object[attribute] <= nodeInfo.threshold : object[attribute]
			}

			node = node.getAdjacentNodes().get(edge)
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

const createClassifier = __webpack_require__(/*! ./createId3Classifier */ "./data-mining/algorithms/id3/createId3Classifier.js")
const constructId3Tree = __webpack_require__(/*! ./constructId3Tree */ "./data-mining/algorithms/id3/constructId3Tree.js")

function trainId3Classifier([columnNames, ...data], continuousAttributes = []) {
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

	if (freqMap.size === 0) return array

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

/***/ "./data-mining/data-utils/index.js":
/*!*****************************************!*\
  !*** ./data-mining/data-utils/index.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../array2d-utils */ "./data-mining/array2d-utils/index.js")

function getDataAsObjects(data) {
	return data.slice(1).map(row => transpose([data[0], row])).map(entries => Object.fromEntries(entries))
}

function calcAccuracy(dataObjects, classifier) {
	const numOfTrue =	dataObjects
		.map(obj => ({
			predicted: classifier.classify(obj).decision,
			actual: obj.decision,
		}))
		.reduce((acc, { predicted, actual }) => acc + (predicted === actual ? 1 : 0), 0)

	return numOfTrue / dataObjects.length
}

const createRandomGenerator = seed => function generateRandom() {
	// https://stackoverflow.com/a/19303725
	const x = Math.sin(seed++) * 100000

	return x - Math.floor(x)
}

function randomShuffle(data, seed) {
	const randomGenerator = createRandomGenerator(seed)
	const shuffledData = [...data]
	shuffledData.sort(() => randomGenerator() - randomGenerator())
	return shuffledData
}

function splitData(data, percentage = 0.2) {
	const len = Math.trunc(data.length * percentage)

	const trainData = [...data]

	const testData = [...trainData.splice(0, len)]

	return [
		trainData,
		testData,
	]
}

module.exports = {
	calcAccuracy, getDataAsObjects, splitData, randomShuffle,
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
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../data-mining/prepareData */ "./data-mining/prepareData.js");
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_data_mining_prepareData__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _data_mining_data_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../data-mining/data-utils */ "./data-mining/data-utils/index.js");
/* harmony import */ var _data_mining_data_utils__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_data_mining_data_utils__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../data-mining/algorithms/id3 */ "./data-mining/algorithms/id3/index.js");
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../data-mining/algorithms/bayes */ "./data-mining/algorithms/bayes/index.js");
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../data-mining/heart_disease_male.csv */ "./data-mining/heart_disease_male.csv");
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_4__);








const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: originalData, attributes } = _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_0___default()({
	data: (_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_4___default()),
	continuosAttributes,
	decisionAttribute: 'disease',
	missingDataValues: ['?', ''],
	positiveDecisionValue: 'positive',
	renameDecisionTo: 'decision',
})

// shuffle and split to match the reports

const shuffledData = (0,_data_mining_data_utils__WEBPACK_IMPORTED_MODULE_1__.randomShuffle)(originalData, 1)

const [trainData] = (0,_data_mining_data_utils__WEBPACK_IMPORTED_MODULE_1__.splitData)(shuffledData, 0.30)
trainData.unshift(attributes.slice())

const id3Classifier = _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_2___default()(trainData, continuosAttributes)
const bayesClassifier = _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_3___default()(trainData, continuosAttributes)

const form = document.querySelector('.heart-diagnosis-from')
const resultEl = document.querySelector('.heart-diagnosis-result')
const resultIcon = resultEl.querySelector('.heart-diagnosis-result .icon')

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFXO0FBQ3RELE9BQU8sNEVBQU87QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDs7QUFFQSxxQkFBcUIsc0VBQWE7O0FBRWxDLG9CQUFvQixrRUFBUztBQUM3Qjs7QUFFQSxzQkFBc0Isa0VBQW1CO0FBQ3pDLHdCQUF3QixvRUFBcUI7O0FBRTdDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBOztBQUVBO0FBQ0EsU0FBUyxXQUFXO0FBQ3BCO0FBQ0E7QUFDQTtBQUNBLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcy9jcmVhdGVCYXllc0NsYXNzaWZpZXIuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvYmF5ZXMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvYmF5ZXMvdXRpbHMuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL2NvbnN0cnVjdElkM1RyZWUuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL2NyZWF0ZUlkM0NsYXNzaWZpZXIuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL2dyYXBoLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvdXRpbHMuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FycmF5MmQtdXRpbHMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2RhdGEtdXRpbHMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL3ByZXBhcmVEYXRhLmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9oZWFydF9kaXNlYXNlX21hbGUuY3N2Iiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL3J1bnRpbWUvY29tcGF0IGdldCBkZWZhdWx0IGV4cG9ydCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgeyBjYWxjR2F1c3NpYW5EZW5zaXR5IH0gPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gY3JlYXRlQmF5ZXNDbGFzc2lmaWVyKHtcblx0ZGVjaXNpb25zRnJlcXMsXG5cdGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLFxuXHRjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMsXG59KSB7XG5cdGNvbnN0IGRlY2lzaW9uc0ZyZXFzU3VtID0gZGVjaXNpb25zRnJlcXMucmVkdWNlKChhY2MsIGZyZXEpID0+IGFjYyArIGZyZXEsIDApXG5cdGNvbnN0IFtQMCwgUDFdID0gZGVjaXNpb25zRnJlcXMubWFwKGZyZXEgPT4gZnJlcSAvIGRlY2lzaW9uc0ZyZXFzU3VtKVxuXG5cdGZ1bmN0aW9uIGdldERpc2NyZXRlQXR0cnNQcm9icyhvYmplY3QpIHtcblx0XHRyZXR1cm4gT2JqZWN0XG5cdFx0XHQuZW50cmllcyhvYmplY3QpXG5cdFx0XHQuZmlsdGVyKChbYXR0ciwgdmFsdWVdKSA9PiAoXG5cdFx0XHRcdGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLmhhcyhhdHRyKSAmJiBkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcy5nZXQoYXR0cikuaGFzKHZhbHVlKVxuXHRcdFx0KSlcblx0XHRcdC5yZWR1Y2UoXG5cdFx0XHRcdChwcm9icywgW2F0dHIsIHZhbHVlXSkgPT4ge1xuXHRcdFx0XHRcdHByb2JzLmZvckVhY2goKF8sIGlkeCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgYXR0ckZyZXFNYXAgPSBkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcy5nZXQoYXR0cilcblx0XHRcdFx0XHRcdGNvbnN0IG51bVVuaXF1ZVZhbHVlcyA9IGF0dHJGcmVxTWFwLnNpemVcblx0XHRcdFx0XHRcdHByb2JzW2lkeF0gKj0gKGF0dHJGcmVxTWFwLmdldCh2YWx1ZSlbaWR4XSArIDEpIC8gKGRlY2lzaW9uc0ZyZXFzW2lkeF0gKyBudW1VbmlxdWVWYWx1ZXMpXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRyZXR1cm4gcHJvYnNcblx0XHRcdFx0fSxcblx0XHRcdFx0WzEsIDFdLFxuXHRcdFx0KVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Q29udGludW91c0F0dHJzUHJvYnMob2JqZWN0KSB7XG5cdFx0cmV0dXJuIE9iamVjdFxuXHRcdFx0LmVudHJpZXMob2JqZWN0KVxuXHRcdFx0LmZpbHRlcigoW2F0dHJdKSA9PiBjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMuaGFzKGF0dHIpKVxuXHRcdFx0LnJlZHVjZShcblx0XHRcdFx0KHByb2JzLCBbYXR0ciwgdmFsdWVdKSA9PiB7XG5cdFx0XHRcdFx0cHJvYnMuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBtdSA9IGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cy5nZXQoYXR0cilbaWR4XS5nZXQoJ211Jylcblx0XHRcdFx0XHRcdGNvbnN0IHNpZ21hID0gY29udGludW9zQXR0cmlidXRlc1N0YXRzLmdldChhdHRyKVtpZHhdLmdldCgnc2lnbWEnKVxuXHRcdFx0XHRcdFx0cHJvYnNbaWR4XSAqPSBjYWxjR2F1c3NpYW5EZW5zaXR5KHZhbHVlLCBtdSwgc2lnbWEpXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRyZXR1cm4gcHJvYnNcblx0XHRcdFx0fSxcblx0XHRcdFx0WzEsIDFdLFxuXHRcdFx0KVxuXHR9XG5cblx0ZnVuY3Rpb24gY2xhc3NpZnkob2JqZWN0KSB7XG5cdFx0Y29uc3QgZGlzY3JldGVBdHRyc1Byb2JzID0gZ2V0RGlzY3JldGVBdHRyc1Byb2JzKG9iamVjdClcblx0XHRjb25zdCBjb250aW51b3VzQXR0cnNQcm9icyA9IGdldENvbnRpbnVvdXNBdHRyc1Byb2JzKG9iamVjdClcblxuXHRcdGNvbnN0IHByb2JzID0gW2Rpc2NyZXRlQXR0cnNQcm9icywgY29udGludW91c0F0dHJzUHJvYnNdXG5cdFx0XHQucmVkdWNlKChhY2MsIGF0dHJQcm9iKSA9PiB7XG5cdFx0XHRcdGFjY1swXSAqPSBhdHRyUHJvYlswXVxuXHRcdFx0XHRhY2NbMV0gKj0gYXR0clByb2JbMV1cblx0XHRcdFx0cmV0dXJuIGFjY1xuXHRcdFx0fSwgW1AwLCBQMV0pXG5cblx0XHRjb25zdCBwcm9ic1N1bSA9IHByb2JzLnJlZHVjZSgoYWNjLCBwKSA9PiBhY2MgKyBwLCAwKVxuXHRcdHByb2JzLmZvckVhY2goKF8sIGlkeCkgPT4ge1xuXHRcdFx0cHJvYnNbaWR4XSAvPSBwcm9ic1N1bVxuXHRcdH0pXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRlY2lzaW9uOiBwcm9ic1swXSA+IHByb2JzWzFdID8gMCA6IDEsXG5cdFx0XHQwOiBwcm9ic1swXSxcblx0XHRcdDE6IHByb2JzWzFdLFxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Y2xhc3NpZnksXG5cdH1cbn1cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQmF5ZXNDbGFzc2lmaWVyXG4iLCJjb25zdCB7IHRyYW5zcG9zZSB9ID0gcmVxdWlyZSgnLi4vLi4vYXJyYXkyZC11dGlscycpXG5jb25zdCBjcmVhdGVCYXllc0NsYXNzaWZpZXIgPSByZXF1aXJlKCcuL2NyZWF0ZUJheWVzQ2xhc3NpZmllcicpXG5cbmZ1bmN0aW9uIGNhbGNBdHRyaWJ1dGVzRnJlcXVlbmNpZXMoYXJyYXkyZCkge1xuXHRjb25zdCBkZWNpc2lvbnNGcmVxcyA9IGFycmF5MmQucmVkdWNlKFxuXHRcdChhY2MsIHJvdykgPT4ge1xuXHRcdFx0YWNjW3Jvdy5hdCgtMSldKytcblx0XHRcdHJldHVybiBhY2Ncblx0XHR9LFxuXHRcdFswLCAwXSxcblx0KVxuXG5cdGNvbnN0IGF0dHJpYnV0ZXNGcmVxdWVuY2llcyA9IHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdC5tYXAoKGF0dHJSb3csIF8sIHRyYW5zcG9zZWRBcnIpID0+IHRyYW5zcG9zZShbYXR0clJvdywgdHJhbnNwb3NlZEFyci5hdCgtMSldKSlcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcChhdHRyUm93QW5kRGVjaXNpb24gPT4gYXR0clJvd0FuZERlY2lzaW9uLnJlZHVjZSgoYXR0ck1hcCwgW2F0dHJWYWx1ZSwgZGVjaXNpb25dKSA9PiB7XG5cdFx0XHRpZiAoIWF0dHJNYXAuaGFzKGF0dHJWYWx1ZSkpIGF0dHJNYXAuc2V0KGF0dHJWYWx1ZSwgWzAsIDBdKVxuXHRcdFx0YXR0ck1hcC5nZXQoYXR0clZhbHVlKVtkZWNpc2lvbl0rK1xuXHRcdFx0cmV0dXJuIGF0dHJNYXBcblx0XHR9LCBuZXcgTWFwKCkpKVxuXG5cdHJldHVybiB7XG5cdFx0YXR0cmlidXRlc0ZyZXF1ZW5jaWVzLFxuXHRcdGRlY2lzaW9uc0ZyZXFzLFxuXHR9XG59XG5mdW5jdGlvbiBjYWxjQXR0cmlidXRlc011U2lnbWEyKGFycmF5MmQpIHtcblx0cmV0dXJuIChcblx0XHR0cmFuc3Bvc2UoYXJyYXkyZClcblx0XHRcdC5tYXAoYXR0clJvdyA9PiBhdHRyUm93XG5cdFx0XHRcdC5yZWR1Y2UoXG5cdFx0XHRcdFx0KGFjYywgdmFsLCBpZHgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGRlY2lzaW9uID0gYXJyYXkyZFtpZHhdLmF0KC0xKVxuXHRcdFx0XHRcdFx0YWNjW2RlY2lzaW9uXS5wdXNoKHZhbClcblx0XHRcdFx0XHRcdHJldHVybiBhY2Ncblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFtbXSwgW11dLFxuXHRcdFx0XHQpXG5cdFx0XHRcdC5tYXAoZ3JvdXBlZEF0dHJSb3cgPT4gZ3JvdXBlZEF0dHJSb3cuZmlsdGVyKHZhbCA9PiB2YWwgIT09IG51bGwpKVxuXHRcdFx0XHQubWFwKGdyb3VwZWRBdHRyUm93ID0+IHtcblx0XHRcdFx0XHRjb25zdCBuID0gZ3JvdXBlZEF0dHJSb3cubGVuZ3RoXG5cdFx0XHRcdFx0Y29uc3QgbXUgPSBncm91cGVkQXR0clJvdy5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MgKyB2YWwsIDApIC8gblxuXHRcdFx0XHRcdGNvbnN0IHNpZ21hID0gKGdyb3VwZWRBdHRyUm93LnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyArICh2YWwgLSBtdSkgKiogMiwgMCkgLyAobiAtIDEpKSAqKiAwLjVcblx0XHRcdFx0XHRyZXR1cm4gbmV3IE1hcChPYmplY3QuZW50cmllcyh7IG11LCBzaWdtYSB9KSlcblx0XHRcdFx0fSkpXG5cdFx0XHQuc2xpY2UoMCwgLTEpXG5cdClcbn1cblxuZnVuY3Rpb24gdHJhaW5OYWl2ZUJheWVzQ2xhc3NpZmllcihbYXR0ck5hbWVzLCAuLi5kYXRhXSwgY29udGludW9zQXR0cmlidXRlcyA9IFtdKSB7XG5cdGNvbnN0IGNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzID0gY29udGludW9zQXR0cmlidXRlcy5tYXAodmFsdWUgPT4gYXR0ck5hbWVzLmZpbmRJbmRleCh2ID0+IHYgPT09IHZhbHVlKSlcblxuXHRjb25zdCBkaXNjcmV0ZUF0dHJpYnV0ZXNJbmRleGVzID0gYXR0ck5hbWVzXG5cdFx0LnNsaWNlKDAsIC0xKVxuXHRcdC5tYXAoKF8sIGlkeCkgPT4gaWR4KVxuXHRcdC5maWx0ZXIoaWR4ID0+ICFjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlcy5pbmNsdWRlcyhpZHgpKVxuXG5cdGNvbnN0IGRhdGFUcmFuc3Bvc2UgPSB0cmFuc3Bvc2UoZGF0YSlcblx0Y29uc3QgZGVjaXNpb25BcnJheSA9IGRhdGFUcmFuc3Bvc2UuYXQoLTEpXG5cblx0bGV0IGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyA9IGNhbGNBdHRyaWJ1dGVzTXVTaWdtYTIoXG5cdFx0dHJhbnNwb3NlKFsuLi5jb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlcy5tYXAoaWR4ID0+IGRhdGFUcmFuc3Bvc2VbaWR4XSksIGRlY2lzaW9uQXJyYXldKSxcblx0KVxuXG5cdGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyA9IG5ldyBNYXAoXG5cdFx0Y29udGludW9zQXR0cmlidXRlc1N0YXRzLm1hcCgoYXR0clN0YXRzLCBpZHgpID0+IFthdHRyTmFtZXNbY29udGludW9zQXR0cmlidXRlc0luZGV4ZXNbaWR4XV0sIGF0dHJTdGF0c10pLFxuXHQpXG5cblx0Y29uc3QgcmVzdWx0ID0gY2FsY0F0dHJpYnV0ZXNGcmVxdWVuY2llcyhcblx0XHR0cmFuc3Bvc2UoWy4uLmRpc2NyZXRlQXR0cmlidXRlc0luZGV4ZXMubWFwKGlkeCA9PiBkYXRhVHJhbnNwb3NlW2lkeF0pLCBkZWNpc2lvbkFycmF5XSksXG5cdClcblxuXHRjb25zdCB7IGRlY2lzaW9uc0ZyZXFzIH0gPSByZXN1bHRcblxuXHRsZXQgeyBhdHRyaWJ1dGVzRnJlcXVlbmNpZXM6IGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzIH0gPSByZXN1bHRcblxuXHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxc1xuXHRcdC5maWx0ZXIoYXR0ck1hcCA9PiBhdHRyTWFwLmhhcyhudWxsKSlcblx0XHQuZm9yRWFjaChhdHRyTWFwID0+IHtcblx0XHRcdGF0dHJNYXAuZGVsZXRlKG51bGwpXG5cdFx0fSlcblxuXHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcyA9IG5ldyBNYXAoXG5cdFx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMubWFwKChhdHRyUHJvYnMsIGlkeCkgPT4gW2F0dHJOYW1lc1tkaXNjcmV0ZUF0dHJpYnV0ZXNJbmRleGVzW2lkeF1dLCBhdHRyUHJvYnNdKSxcblx0KVxuXG5cdHJldHVybiBjcmVhdGVCYXllc0NsYXNzaWZpZXIoeyBkZWNpc2lvbnNGcmVxcywgZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMsIGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYWluTmFpdmVCYXllc0NsYXNzaWZpZXJcbiIsImZ1bmN0aW9uIGNhbGNHYXVzc2lhbkRlbnNpdHkoeCwgbXUsIHNpZ21hKSB7XG5cdHJldHVybiBNYXRoLmV4cCgtKCh4IC0gbXUpICoqIDIpIC8gKDIgKiBzaWdtYSAqKiAyKSkgLyAoKCgyICogTWF0aC5QSSkgKiogMC41KSAqIHNpZ21hKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgY2FsY0dhdXNzaWFuRGVuc2l0eSB9XG4iLCJjb25zdCB7IGNyZWF0ZU5vZGUsIGNyZWF0ZUxlYWZOb2RlIH0gPSByZXF1aXJlKCcuL2dyYXBoJylcbmNvbnN0IHsgcGFydGl0aW9uMmRBcnJheSwgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IHsgY2FsY01hdHJpeEdhaW5SYXRpbywgY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZSwgZmlsbE1pc3NpbmdWYWx1ZXMgfSA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG5mdW5jdGlvbiBjYWxjRGVjaXNpb25zRnJlcXVlbmN5KGRhdGEpIHtcblx0cmV0dXJuIGRhdGFcblx0XHQubWFwKHJvdyA9PiByb3cuYXQoLTEpKVxuXHRcdC5yZWR1Y2UoXG5cdFx0XHQoYWNjLCBkZWNpc2lvbikgPT4ge1xuXHRcdFx0XHRhY2NbZGVjaXNpb25dKytcblx0XHRcdFx0cmV0dXJuIGFjY1xuXHRcdFx0fSxcblx0XHRcdFswLCAwXSxcblx0XHQpXG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlc0ZyZXF1ZW5jaWVzKGFycmF5KSB7XG5cdHJldHVybiBhcnJheVxuXHRcdC5yZWR1Y2UoKG1hcCwgdmFsdWUpID0+IHtcblx0XHRcdGlmICghbWFwLmhhcyh2YWx1ZSkpIG1hcC5zZXQodmFsdWUsIDApXG5cblx0XHRcdG1hcC5zZXQodmFsdWUsIG1hcC5nZXQodmFsdWUpICsgMSlcblxuXHRcdFx0cmV0dXJuIG1hcFxuXHRcdH0sIG5ldyBNYXAoKSlcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZXhlc09mUmVkdW5kYW50QXR0cmlidXRlcyhkYXRhKSB7XG5cdHJldHVybiB0cmFuc3Bvc2UoZGF0YSlcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcCgoY29sLCBpZHgpID0+IFtjb2wsIGlkeF0pXG5cdFx0LmZpbHRlcigoW2NvbF0pID0+IHtcblx0XHRcdGNvbnN0IHVuaXF1ZVZhbHVlcyA9IG5ldyBTZXQoY29sKVxuXHRcdFx0cmV0dXJuIHVuaXF1ZVZhbHVlcy5zaXplID09PSAxIHx8ICh1bmlxdWVWYWx1ZXMuc2l6ZSA9PT0gMiAmJiB1bmlxdWVWYWx1ZXMuaGFzKG51bGwpKVxuXHRcdH0pXG5cdFx0Lm1hcCgoWywgb3JpZ0lkeF0pID0+IG9yaWdJZHgpXG59XG5cbmZ1bmN0aW9uIGV4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzKGRhdGEsIGNvbHVtbk5hbWVzKSB7XG5cdGNvbnN0IHJlZHVuZGFudENvbEluZGV4ZXMgPSBnZXRJbmRleGVzT2ZSZWR1bmRhbnRBdHRyaWJ1dGVzKGRhdGEpXG5cblx0aWYgKCFyZWR1bmRhbnRDb2xJbmRleGVzLmxlbmd0aCkgcmV0dXJuIHsgZGF0YSwgY29sdW1uTmFtZXMgfVxuXG5cdGNvbnN0IGNsZWFuZWREYXRhID0gdHJhbnNwb3NlKHRyYW5zcG9zZShkYXRhKS5maWx0ZXIoKF8sIGlkeCkgPT4gIXJlZHVuZGFudENvbEluZGV4ZXMuaW5jbHVkZXMoaWR4KSkpXG5cdGNvbnN0IGNsZWFuZWRDb2x1bW5OYW1lcyA9IGNvbHVtbk5hbWVzLmZpbHRlcigoXywgaWR4KSA9PiAhcmVkdW5kYW50Q29sSW5kZXhlcy5pbmNsdWRlcyhpZHgpKVxuXG5cdHJldHVybiB7IGRhdGE6IGNsZWFuZWREYXRhLCBjb2x1bW5OYW1lczogY2xlYW5lZENvbHVtbk5hbWVzIH1cbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtQ29udGludW91c0F0dHJpYnV0ZXNUb0Rpc2NyZXRlKGRhdGEsIGNvbHVtbk5hbWVzLCBjb250aW51b3VzQXR0cmlidXRlcykge1xuXHRjb25zdCBjb250aW51b3NJbmRleGVzID0gY29udGludW91c0F0dHJpYnV0ZXNcblx0XHQubWFwKGNvbnRBdHRyID0+IGNvbHVtbk5hbWVzLmZpbmRJbmRleChjb2xOYW1lID0+IGNvbE5hbWUgPT09IGNvbnRBdHRyKSlcblxuXHRjb25zdCBkYXRhVHJhbnNwb3NlID0gdHJhbnNwb3NlKGRhdGEpXG5cblx0Y29uc3QgdGhyZXNob2xkcyA9IGNvbnRpbnVvc0luZGV4ZXNcblx0XHQubWFwKGNvbnRJZHggPT4ge1xuXHRcdFx0Y29uc3QgeyB0aHJlc2hvbGQgfSA9IGNhbGNDb250aW51b3VzVGhyZXNob2xkVmFsdWUoZGF0YVRyYW5zcG9zZVtjb250SWR4XSwgZGF0YVRyYW5zcG9zZS5hdCgtMSkpXG5cdFx0XHRjb25zdCBhdHRyaWJ1dGVOYW1lID0gY29sdW1uTmFtZXNbY29udElkeF1cblx0XHRcdHJldHVybiB7IGF0dHJpYnV0ZU5hbWUsIHRocmVzaG9sZCB9XG5cdFx0fSlcblx0XHQucmVkdWNlKChhY2MsIHsgdGhyZXNob2xkLCBhdHRyaWJ1dGVOYW1lIH0pID0+IHtcblx0XHRcdGFjYy5zZXQoYXR0cmlidXRlTmFtZSwgdGhyZXNob2xkKVxuXHRcdFx0cmV0dXJuIGFjY1xuXHRcdH0sIG5ldyBNYXAoKSlcblxuXHRjb25zdCBkaXNjcmV0ZURhdGEgPSB0cmFuc3Bvc2UoXG5cdFx0ZGF0YVRyYW5zcG9zZS5tYXAoKGF0dHJWYWx1ZXMsIGlkeCkgPT4ge1xuXHRcdFx0aWYgKCFjb250aW51b3NJbmRleGVzLmluY2x1ZGVzKGlkeCkpIHJldHVybiBhdHRyVmFsdWVzXG5cdFx0XHRjb25zdCBhdHRyTmFtZSA9IGNvbHVtbk5hbWVzW2lkeF1cblx0XHRcdHJldHVybiBhdHRyVmFsdWVzLm1hcCh2YWx1ZSA9PiB2YWx1ZSA8PSB0aHJlc2hvbGRzLmdldChhdHRyTmFtZSkpXG5cdFx0fSksXG5cdClcblxuXHRyZXR1cm4geyB0aHJlc2hvbGRzLCBkaXNjcmV0ZURhdGEgfVxufVxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJZDNUcmVlKHtcblx0ZGF0YTogZGF0YUFyZyxcblx0Y29sdW1uTmFtZXM6IGNvbHVtbk5hbWVzQXJnLFxuXHRjb250aW51b3VzQXR0cmlidXRlczogY29udGludW91c0F0dHJpYnV0ZXNBcmcsXG59KSB7XG5cdGNvbnN0IHsgZGF0YSwgY29sdW1uTmFtZXMgfSA9IGV4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzKGRhdGFBcmcsIGNvbHVtbk5hbWVzQXJnKVxuXHRjb25zdCBjb250aW51b3VzQXR0cmlidXRlcyA9IGNvbnRpbnVvdXNBdHRyaWJ1dGVzQXJnLmZpbHRlcihuYW1lID0+IGNvbHVtbk5hbWVzLmluY2x1ZGVzKG5hbWUpKVxuXG5cdGNvbnN0IGRlY2lzaW9uc0ZyZXEgPSBjYWxjRGVjaXNpb25zRnJlcXVlbmN5KGRhdGEpXG5cdGNvbnN0IG1vc3RGcmVxdWVudERlY2lzaW9uID0gZGVjaXNpb25zRnJlcVswXSA+IGRlY2lzaW9uc0ZyZXFbMV0gPyAwIDogMVxuXG5cdGNvbnN0IG5vZGVJbmZvID0ge1xuXHRcdGRlY2lzaW9uc0ZyZXF1ZW5jeTogZGVjaXNpb25zRnJlcSxcblx0XHRtb3N0RnJlcXVlbnREZWNpc2lvbixcblx0fVxuXG5cdGlmIChkZWNpc2lvbnNGcmVxLnNvbWUoZnJlcSA9PiBmcmVxID09PSAwKSB8fCBkYXRhWzBdLmxlbmd0aCA9PT0gMSkge1xuXHRcdC8vIGJhc2UgY2FzZXM6IGFsbCBkZWNpc2lvbiB2YWx1ZXMgYXJlIHRoZSBzYW1lLCBvciB0aGUgZGF0YSBoYXMgbm8gYXR0cmlidXRlc1xuXHRcdC8vIHJlbWVtYmVyICdleGNsdWRlUmVkdW5kYW50QXR0cmlidXRlcydcblx0XHRyZXR1cm4gY3JlYXRlTGVhZk5vZGUoT2JqZWN0LmFzc2lnbihub2RlSW5mbywgeyBkZWNpc2lvbjogbW9zdEZyZXF1ZW50RGVjaXNpb24gfSkpXG5cdH1cblxuXHRjb25zdCBkYXRhTm9NaXNzaW5nID0gdHJhbnNwb3NlKHRyYW5zcG9zZShkYXRhKS5tYXAoY29sID0+IGZpbGxNaXNzaW5nVmFsdWVzKGNvbCkpKVxuXG5cdGNvbnN0IHsgZGlzY3JldGVEYXRhLCB0aHJlc2hvbGRzIH0gPSB0cmFuc2Zvcm1Db250aW51b3VzQXR0cmlidXRlc1RvRGlzY3JldGUoXG5cdFx0ZGF0YU5vTWlzc2luZyxcblx0XHRjb2x1bW5OYW1lcyxcblx0XHRjb250aW51b3VzQXR0cmlidXRlcyxcblx0KVxuXG5cdGNvbnN0IGF0dHJpYnV0ZXNHYWluUmF0aW8gPSBjYWxjTWF0cml4R2FpblJhdGlvKGRpc2NyZXRlRGF0YSlcblx0Y29uc3QgbWF4R2FpblJhdGlvSWR4ID0gYXR0cmlidXRlc0dhaW5SYXRpby5yZWR1Y2UoXG5cdFx0KGN1ck1heElkeCwgY3VyR2FpblJhdGlvLCBpZHgsIGdhaW5SYXRpb3MpID0+IChjdXJHYWluUmF0aW8gPiBnYWluUmF0aW9zW2N1ck1heElkeF0gPyBpZHggOiBjdXJNYXhJZHgpLFxuXHRcdDAsXG5cdClcblxuXHRjb25zdCBhdHRyaWJ1dGVWYWx1ZXNGcmVxdWVuY2llcyA9IGdldFZhbHVlc0ZyZXF1ZW5jaWVzKHRyYW5zcG9zZShkaXNjcmV0ZURhdGEpW21heEdhaW5SYXRpb0lkeF0pXG5cdGNvbnN0IHsgdmFsdWU6IG1vc3RGcmVxdWVudEF0dHJpYnV0ZVZhbHVlIH0gPSBbLi4uYXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMuZW50cmllcygpXVxuXHRcdC5yZWR1Y2UoKGJlc3QsIFt2YWx1ZSwgZnJlcV0pID0+IHtcblx0XHRcdGlmIChiZXN0ID09PSBudWxsIHx8IGZyZXEgPiBiZXN0LmZyZXEpIHJldHVybiB7IHZhbHVlLCBmcmVxIH1cblx0XHRcdHJldHVybiBiZXN0XG5cdFx0fSwgbnVsbClcblxuXHRPYmplY3QuYXNzaWduKG5vZGVJbmZvLCB7XG5cdFx0Z2FpblJhdGlvOiBhdHRyaWJ1dGVzR2FpblJhdGlvW21heEdhaW5SYXRpb0lkeF0sXG5cdFx0YXR0cmlidXRlOiBjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdLFxuXHRcdGF0dHJpYnV0ZVZhbHVlc0ZyZXF1ZW5jaWVzLFxuXHRcdG1vc3RGcmVxdWVudEF0dHJpYnV0ZVZhbHVlLFxuXHR9KVxuXG5cdGlmIChjb250aW51b3VzQXR0cmlidXRlcy5pbmNsdWRlcyhjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdKSkge1xuXHRcdG5vZGVJbmZvLmlzQ29udGludW91cyA9IHRydWVcblx0XHRub2RlSW5mby50aHJlc2hvbGQgPSB0aHJlc2hvbGRzLmdldChjb2x1bW5OYW1lc1ttYXhHYWluUmF0aW9JZHhdKVxuXHR9IGVsc2Uge1xuXHRcdG5vZGVJbmZvLmlzQ29udGludW91cyA9IGZhbHNlXG5cdH1cblxuXHRjb25zdCBjb2x1bW5zVG9TZW5kID0gY29sdW1uTmFtZXMuZmlsdGVyKChfLCBpZHgpID0+IGlkeCAhPT0gbWF4R2FpblJhdGlvSWR4KVxuXG5cdGxldCBkYXRhVG9QYXJ0aXRpb24gPSB0cmFuc3Bvc2UoZGF0YSlcblx0ZGF0YVRvUGFydGl0aW9uW21heEdhaW5SYXRpb0lkeF0gPSB0cmFuc3Bvc2UoZGlzY3JldGVEYXRhKVttYXhHYWluUmF0aW9JZHhdXG5cdGRhdGFUb1BhcnRpdGlvbiA9IHRyYW5zcG9zZShkYXRhVG9QYXJ0aXRpb24pXG5cblx0Y29uc3Qgbm9kZSA9IGNyZWF0ZU5vZGUobm9kZUluZm8pXG5cblx0cGFydGl0aW9uMmRBcnJheShkYXRhVG9QYXJ0aXRpb24sIG1heEdhaW5SYXRpb0lkeCkuZm9yRWFjaCgocGFydGl0aW9uZWREYXRhLCBjb2xWYWx1ZU5hbWUpID0+IHtcblx0XHRub2RlLmFkZEFkamFjZW50Tm9kZShcblx0XHRcdGNvbFZhbHVlTmFtZSxcblx0XHRcdGNvbnN0cnVjdElkM1RyZWUoe1xuXHRcdFx0XHRkYXRhOiBwYXJ0aXRpb25lZERhdGEsXG5cdFx0XHRcdGNvbHVtbk5hbWVzOiBjb2x1bW5zVG9TZW5kLFxuXHRcdFx0XHRjb250aW51b3VzQXR0cmlidXRlcyxcblx0XHRcdH0pLFxuXHRcdClcblx0fSlcblx0cmV0dXJuIG5vZGVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb25zdHJ1Y3RJZDNUcmVlXG4iLCJmdW5jdGlvbiBjcmVhdGVJZDNDbGFzc2lmaWVyKHsgcm9vdE5vZGUsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pIHtcblx0Y29uc3Qgbm9kZXMgPSBnZXRBbGxUcmVlTm9kZXMocm9vdE5vZGUpXG5cblx0ZnVuY3Rpb24gb2JqZWN0SGFzVmFsaWRBdHRyaWJ1dGVWYWx1ZShvYmplY3QsIGF0dHJpYnV0ZSwgbm9kZSkge1xuXHRcdGlmICghKGF0dHJpYnV0ZSBpbiBvYmplY3QpKSByZXR1cm4gZmFsc2VcblxuXHRcdGNvbnN0IG5vZGVJbmZvID0gbm9kZS5nZXROb2RlSW5mbygpXG5cdFx0Y29uc3QgYWRqYWNlbnROb2RlcyA9IG5vZGUuZ2V0QWRqYWNlbnROb2RlcygpXG5cdFx0Y29uc3QgYXR0cmlidXRlVmFsdWUgPSBvYmplY3RbYXR0cmlidXRlXVxuXG5cdFx0aWYgKG5vZGVJbmZvLmlzQ29udGludW91cykgcmV0dXJuIE51bWJlci5pc0Zpbml0ZShhdHRyaWJ1dGVWYWx1ZSlcblx0XHRyZXR1cm4gYWRqYWNlbnROb2Rlcy5oYXMoYXR0cmlidXRlVmFsdWUpXG5cdH1cblxuXHRmdW5jdGlvbiBjbGFzc2lmeShvYmplY3QpIHtcblx0XHRsZXQgbm9kZSA9IHJvb3ROb2RlXG5cdFx0Y29uc3QgcGF0aCA9IFtdXG5cdFx0bGV0IGRlY2lzaW9uID0gbnVsbFxuXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IG5vZGVJbmZvID0gbm9kZS5nZXROb2RlSW5mbygpXG5cblx0XHRcdGlmIChub2RlLmlzTGVhZigpKSB7XG5cdFx0XHRcdGRlY2lzaW9uID0gbm9kZUluZm8uZGVjaXNpb25cblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBhdHRyaWJ1dGUgfSA9IG5vZGVJbmZvXG5cdFx0XHRwYXRoLnB1c2goYXR0cmlidXRlKVxuXG5cdFx0XHRsZXQgZWRnZVxuXG5cdFx0XHRpZiAoIW9iamVjdEhhc1ZhbGlkQXR0cmlidXRlVmFsdWUob2JqZWN0LCBhdHRyaWJ1dGUsIG5vZGUpKSB7XG5cdFx0XHRcdGVkZ2UgPSBub2RlSW5mby5tb3N0RnJlcXVlbnRBdHRyaWJ1dGVWYWx1ZVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRnZSA9IG5vZGVJbmZvLmlzQ29udGludW91cyA/IG9iamVjdFthdHRyaWJ1dGVdIDw9IG5vZGVJbmZvLnRocmVzaG9sZCA6IG9iamVjdFthdHRyaWJ1dGVdXG5cdFx0XHR9XG5cblx0XHRcdG5vZGUgPSBub2RlLmdldEFkamFjZW50Tm9kZXMoKS5nZXQoZWRnZSlcblx0XHR9XG5cblx0XHRyZXR1cm4geyBkZWNpc2lvbiwgcGF0aCB9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRSb290Tm9kZSgpIHtcblx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSh7IC4uLnJvb3ROb2RlIH0pXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRBbGxUcmVlTm9kZXMocm9vdCkge1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXAoKVxuXG5cdFx0Y29uc3QgcSA9IFtyb290XVxuXG5cdFx0Zm9yIChsZXQgbGVuID0gcS5sZW5ndGg7IGxlbiA+IDA7IGxlbiA9IHEubGVuZ3RoKSB7XG5cdFx0XHR3aGlsZSAobGVuLS0pIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHEuc2hpZnQoKVxuXHRcdFx0XHRtYXAuc2V0KG5vZGUuZ2V0SWQoKSwgbm9kZSlcblx0XHRcdFx0aWYgKG5vZGUuaXNMZWFmKCkpIGNvbnRpbnVlXG5cdFx0XHRcdG5vZGUuZ2V0QWRqYWNlbnROb2RlcygpLmZvckVhY2goYWRqTm9kZSA9PiBxLnB1c2goYWRqTm9kZSkpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hcFxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VHJlZU5vZGVzKCkge1xuXHRcdHJldHVybiBub2Rlc1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjbGFzc2lmeSxcblx0XHRnZXRUcmVlTm9kZXMsXG5cdFx0Z2V0Um9vdE5vZGUsXG5cdH1cbn1cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlSWQzQ2xhc3NpZmllclxuIiwibGV0IGlkeCA9IDBcblxuZnVuY3Rpb24gY3JlYXRlTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0Y29uc3QgYWRqYWNlbnROb2RlcyA9IG5ldyBNYXAoKVxuXG5cdGZ1bmN0aW9uIGdldE5vZGVJbmZvKCkge1xuXHRcdHJldHVybiBub2RlSW5mb1xuXHR9XG5cblx0ZnVuY3Rpb24gYWRkQWRqYWNlbnROb2RlKGVkZ2UsIG5vZGUpIHtcblx0XHRhZGphY2VudE5vZGVzLnNldChlZGdlLCBub2RlKVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0QWRqYWNlbnROb2RlcygpIHtcblx0XHRyZXR1cm4gbmV3IE1hcChhZGphY2VudE5vZGVzKVxuXHR9XG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0SWQoKSB7XG5cdFx0cmV0dXJuIGlkXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldElkLFxuXHRcdGlzTGVhZixcblx0XHRhZGRBZGphY2VudE5vZGUsXG5cdFx0Z2V0QWRqYWNlbnROb2Rlcyxcblx0XHRnZXROb2RlSW5mbyxcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVMZWFmTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiB0cnVlXG5cdH1cblx0ZnVuY3Rpb24gZ2V0Tm9kZUluZm8oKSB7XG5cdFx0cmV0dXJuIG5vZGVJbmZvXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJZCgpIHtcblx0XHRyZXR1cm4gaWRcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0SWQsXG5cdFx0aXNMZWFmLFxuXHRcdGdldE5vZGVJbmZvLFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjcmVhdGVOb2RlLFxuXHRjcmVhdGVMZWFmTm9kZSxcbn1cbiIsImNvbnN0IGNyZWF0ZUNsYXNzaWZpZXIgPSByZXF1aXJlKCcuL2NyZWF0ZUlkM0NsYXNzaWZpZXInKVxuY29uc3QgY29uc3RydWN0SWQzVHJlZSA9IHJlcXVpcmUoJy4vY29uc3RydWN0SWQzVHJlZScpXG5cbmZ1bmN0aW9uIHRyYWluSWQzQ2xhc3NpZmllcihbY29sdW1uTmFtZXMsIC4uLmRhdGFdLCBjb250aW51b3VzQXR0cmlidXRlcyA9IFtdKSB7XG5cdGNvbnN0IHJvb3ROb2RlID0gY29uc3RydWN0SWQzVHJlZSh7IGRhdGEsIGNvbHVtbk5hbWVzLCBjb250aW51b3VzQXR0cmlidXRlcyB9KVxuXG5cdHJldHVybiBjcmVhdGVDbGFzc2lmaWVyKHsgcm9vdE5vZGUsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gdHJhaW5JZDNDbGFzc2lmaWVyXG4iLCJjb25zdCB7IHRyYW5zcG9zZSB9ID0gcmVxdWlyZSgnLi4vLi4vYXJyYXkyZC11dGlscycpXG5cbmZ1bmN0aW9uIGZpbGxNaXNzaW5nVmFsdWVzKGFycmF5KSB7XG5cdGNvbnN0IGZyZXFNYXAgPSBuZXcgTWFwKClcblxuXHRhcnJheVxuXHRcdC5maWx0ZXIodmFsdWUgPT4gdmFsdWUgIT09IG51bGwpXG5cdFx0LmZvckVhY2godmFsdWUgPT4ge1xuXHRcdFx0Y29uc3QgcHJlRnJlcSA9IGZyZXFNYXAuaGFzKHZhbHVlKSA/IGZyZXFNYXAuZ2V0KHZhbHVlKSA6IDBcblx0XHRcdGZyZXFNYXAuc2V0KHZhbHVlLCBwcmVGcmVxICsgMSlcblx0XHR9KVxuXG5cdGlmIChmcmVxTWFwLnNpemUgPT09IDApIHJldHVybiBhcnJheVxuXG5cdGNvbnN0IGZyZXFBcnJheSA9IFsuLi5mcmVxTWFwLmVudHJpZXMoKV1cblxuXHRjb25zdCBudW1Ob25NaXNzaW5nVmFsdWVzID0gZnJlcUFycmF5LnJlZHVjZSgoYWNjLCBbLCBmcmVxXSkgPT4gYWNjICsgZnJlcSwgMClcblxuXHRjb25zdCBwcm9iQXJyYXkgPSBbLi4uZnJlcUFycmF5XVxuXHRcdC5zb3J0KChbLCBmcmVxMV0sIFssIGZyZXEyXSkgPT4gZnJlcTEgLSBmcmVxMilcblx0XHQubWFwKChbdmFsdWUsIGZyZXFdKSA9PiBbdmFsdWUsIGZyZXEgLyBudW1Ob25NaXNzaW5nVmFsdWVzXSlcblxuXHRwcm9iQXJyYXkuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0cHJvYkFycmF5W2lkeF1bMV0gKz0gaWR4ID09PSAwID8gMCA6IHByb2JBcnJheVtpZHggLSAxXVsxXVxuXHR9KVxuXG5cdHJldHVybiBhcnJheS5tYXAodmFsdWUgPT4ge1xuXHRcdGlmICh2YWx1ZSAhPT0gbnVsbCkgcmV0dXJuIHZhbHVlXG5cdFx0Y29uc3QgcmFuZCA9IE1hdGgucmFuZG9tKClcblx0XHRyZXR1cm4gcHJvYkFycmF5LmZpbmQoKFssIHByb2JdKSA9PiByYW5kIDw9IHByb2IpWzBdXG5cdH0pXG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZVZhbHVlc0ZyZXF1ZW5jaWVzKGFycmF5MmQpIHtcblx0Lypcblx0W1xuXHRcdHthdHRyMVYxOiBbbiwgcF0sIGF0dHIxVjI6IFtuLCBwXSwgYXR0cjFWMzogW24sIHBdfSxcblx0XHR7YXR0cjJWMTogW24sIHBdLCBhdHRyMlYyOiBbbiwgcF0sIGF0dHIyVjM6IFtuLCBwXX0sXG5cdFx0Li5cblx0XVxuXHQqL1xuXHRyZXR1cm4gdHJhbnNwb3NlKGFycmF5MmQpXG5cdFx0Lm1hcCgoYXR0clJvdywgXywgdHJhbnNwb3NlZEFycikgPT4gW2F0dHJSb3csIHRyYW5zcG9zZWRBcnIuYXQoLTEpXSlcblx0XHQubWFwKHRyYW5zcG9zZSlcblx0XHQubWFwKGF0dHJEZWNpc2lvbiA9PiBhdHRyRGVjaXNpb24ucmVkdWNlKChtYXAsIFthdHRyVmFsLCBkZWNpc2lvbl0pID0+IHtcblx0XHRcdGlmICghbWFwLmhhcyhhdHRyVmFsKSkgbWFwLnNldChhdHRyVmFsLCBbMCwgMF0pXG5cdFx0XHRtYXAuZ2V0KGF0dHJWYWwpW2RlY2lzaW9uXSsrXG5cdFx0XHRyZXR1cm4gbWFwXG5cdFx0fSwgbmV3IE1hcCgpKSlcbn1cblxuZnVuY3Rpb24gY2FsY0VudHJvcHkoYXJyYXkpIHtcblx0Y29uc3Qgc3VtID0gYXJyYXkucmVkdWNlKChhY2MsIHYpID0+IGFjYyArIHYsIDApXG5cdHJldHVybiAtYXJyYXkucmVkdWNlKChhY2MsIHYpID0+IChhY2MgKyAodiA9PT0gMCA/IDAgOiAodiAvIHN1bSkgKiBNYXRoLmxvZzIodiAvIHN1bSkpKSwgMClcbn1cblxuZnVuY3Rpb24gY2FsY01hdHJpeEdhaW5SYXRpbyhhcnJheTJkKSB7XG5cdGNvbnN0IG51bVNhbXBsZXMgPSBhcnJheTJkLmxlbmd0aFxuXG5cdGNvbnN0IGF0dHJpYnV0ZVZhbHVlc0ZyZXFzID0gZ2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMoYXJyYXkyZClcblxuXHRjb25zdCBkYXRhRW50cm9weSA9IGNhbGNFbnRyb3B5KFtcblx0XHRhdHRyaWJ1dGVWYWx1ZXNGcmVxcy5hdCgtMSkuZ2V0KDApWzBdLFxuXHRcdGF0dHJpYnV0ZVZhbHVlc0ZyZXFzLmF0KC0xKS5nZXQoMSlbMV0sXG5cdF0pXG5cblx0Y29uc3QgaW5mb0VudHJvcGllcyA9IGF0dHJpYnV0ZVZhbHVlc0ZyZXFzXG5cdFx0LnNsaWNlKDAsIC0xKVxuXHRcdC5tYXAoYXR0ck1hcCA9PiAoXG5cdFx0XHRbLi4uYXR0ck1hcC52YWx1ZXMoKV0ucmVkdWNlKChhY2MsIFtuLCBwXSkgPT4gYWNjICsgKGNhbGNFbnRyb3B5KFtuLCBwXSkgKiAobiArIHApKSAvIG51bVNhbXBsZXMsIDApXG5cdFx0KSlcblxuXHRjb25zdCBpbmZvR2FpbnMgPSBpbmZvRW50cm9waWVzLm1hcChpZSA9PiBkYXRhRW50cm9weSAtIGllKVxuXG5cdGNvbnN0IHNwbGl0SW5mb3MgPSBhdHRyaWJ1dGVWYWx1ZXNGcmVxc1xuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKGF0dHJNYXAgPT4gWy4uLmF0dHJNYXAudmFsdWVzKCldLm1hcCgoW24sIHBdKSA9PiBuICsgcCkpXG5cdFx0Lm1hcChhdHRyVmFsdWVzQ250QXJyYXkgPT4gY2FsY0VudHJvcHkoYXR0clZhbHVlc0NudEFycmF5KSlcblxuXHRyZXR1cm4gaW5mb0dhaW5zLm1hcCgoZywgaWR4KSA9PiBnIC8gc3BsaXRJbmZvc1tpZHhdKVxufVxuXG5mdW5jdGlvbiBjYWxjQ29udGludW91c1RocmVzaG9sZFZhbHVlKHZhbHVlc0FycmF5LCBkZWNpc2lvbnMpIHtcblx0Y29uc3Qgc29ydGVkVW5pcXVlVmFsdWVzID0gWy4uLm5ldyBTZXQodmFsdWVzQXJyYXkpXS5zb3J0KChhLCBiKSA9PiBhIC0gYilcblxuXHRjb25zb2xlLmFzc2VydChzb3J0ZWRVbmlxdWVWYWx1ZXMubGVuZ3RoID49IDIpXG5cblx0cmV0dXJuIHNvcnRlZFVuaXF1ZVZhbHVlc1xuXHRcdC5yZWR1Y2UoKGJlc3QsIF8sIGlkeCkgPT4ge1xuXHRcdFx0aWYgKGlkeCA9PT0gMCkgcmV0dXJuIG51bGxcblxuXHRcdFx0Y29uc3QgdGhyZXNob2xkID0gKHNvcnRlZFVuaXF1ZVZhbHVlc1tpZHhdICsgc29ydGVkVW5pcXVlVmFsdWVzW2lkeCAtIDFdKSAvIDJcblx0XHRcdGNvbnN0IFtnYWluUmF0aW9dID0gY2FsY01hdHJpeEdhaW5SYXRpbyhcblx0XHRcdFx0dHJhbnNwb3NlKFt2YWx1ZXNBcnJheS5tYXAodmFsdWUgPT4gdmFsdWUgPD0gdGhyZXNob2xkKSwgZGVjaXNpb25zXSksXG5cdFx0XHQpXG5cblx0XHRcdGlmIChiZXN0ID09PSBudWxsIHx8IGdhaW5SYXRpbyA+IGJlc3QuZ2FpblJhdGlvKSByZXR1cm4geyB0aHJlc2hvbGQsIGdhaW5SYXRpbyB9XG5cblx0XHRcdHJldHVybiBiZXN0XG5cdFx0fSwgbnVsbClcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdGNhbGNDb250aW51b3VzVGhyZXNob2xkVmFsdWUsXG5cdGNhbGNFbnRyb3B5LFxuXHRjYWxjTWF0cml4R2FpblJhdGlvLFxuXHRmaWxsTWlzc2luZ1ZhbHVlcyxcblx0Z2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMsXG59XG4iLCJmdW5jdGlvbiBwYXJ0aXRpb24yZEFycmF5KGFycmF5MmQsIGNvbHVtbklkeCkge1xuXHRjb25zdCBudW1Db2x1bW5zID0gYXJyYXkyZFswXS5sZW5ndGhcblx0Y29sdW1uSWR4ID0gKChjb2x1bW5JZHggJSBudW1Db2x1bW5zKSArIG51bUNvbHVtbnMpICUgbnVtQ29sdW1uc1xuXG5cdHJldHVybiBhcnJheTJkLnJlZHVjZSgocGFydHMsIHJvdykgPT4ge1xuXHRcdGNvbnN0IHRhcmdldENvbHVtblZhbHVlID0gcm93W2NvbHVtbklkeF1cblxuXHRcdGlmICghcGFydHMuaGFzKHRhcmdldENvbHVtblZhbHVlKSkgcGFydHMuc2V0KHRhcmdldENvbHVtblZhbHVlLCBbXSlcblxuXHRcdHBhcnRzLmdldCh0YXJnZXRDb2x1bW5WYWx1ZSkucHVzaChbLi4ucm93LnNsaWNlKDAsIGNvbHVtbklkeCksIC4uLnJvdy5zbGljZShjb2x1bW5JZHggKyAxKV0pXG5cblx0XHRyZXR1cm4gcGFydHNcblx0fSwgbmV3IE1hcCgpKVxufVxuXG5mdW5jdGlvbiB0cmFuc3Bvc2UoYXJyYXkpIHtcblx0Y29uc3Qgcm93cyA9IGFycmF5Lmxlbmd0aFxuXG5cdGlmIChyb3dzID09PSAwKSByZXR1cm4gW11cblxuXHRjb25zdCBjb2xzID0gYXJyYXlbMF0ubGVuZ3RoXG5cblx0aWYgKGNvbHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRyYW5zcG9zZShbYXJyYXldKVxuXG5cdGNvbnN0IHJldCA9IG5ldyBBcnJheShjb2xzKS5maWxsKG51bGwpLm1hcCgoKSA9PiBuZXcgQXJyYXkocm93cykuZmlsbChudWxsKSlcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHJvd3M7IGkrKykge1xuXHRcdGZvciAobGV0IGogPSAwOyBqIDwgY29sczsgaisrKSB7XG5cdFx0XHRyZXRbal1baV0gPSBhcnJheVtpXVtqXVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHBhcnRpdGlvbjJkQXJyYXksXG5cdHRyYW5zcG9zZSxcbn1cbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi9hcnJheTJkLXV0aWxzJylcblxuZnVuY3Rpb24gZ2V0RGF0YUFzT2JqZWN0cyhkYXRhKSB7XG5cdHJldHVybiBkYXRhLnNsaWNlKDEpLm1hcChyb3cgPT4gdHJhbnNwb3NlKFtkYXRhWzBdLCByb3ddKSkubWFwKGVudHJpZXMgPT4gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpKVxufVxuXG5mdW5jdGlvbiBjYWxjQWNjdXJhY3koZGF0YU9iamVjdHMsIGNsYXNzaWZpZXIpIHtcblx0Y29uc3QgbnVtT2ZUcnVlID1cdGRhdGFPYmplY3RzXG5cdFx0Lm1hcChvYmogPT4gKHtcblx0XHRcdHByZWRpY3RlZDogY2xhc3NpZmllci5jbGFzc2lmeShvYmopLmRlY2lzaW9uLFxuXHRcdFx0YWN0dWFsOiBvYmouZGVjaXNpb24sXG5cdFx0fSkpXG5cdFx0LnJlZHVjZSgoYWNjLCB7IHByZWRpY3RlZCwgYWN0dWFsIH0pID0+IGFjYyArIChwcmVkaWN0ZWQgPT09IGFjdHVhbCA/IDEgOiAwKSwgMClcblxuXHRyZXR1cm4gbnVtT2ZUcnVlIC8gZGF0YU9iamVjdHMubGVuZ3RoXG59XG5cbmNvbnN0IGNyZWF0ZVJhbmRvbUdlbmVyYXRvciA9IHNlZWQgPT4gZnVuY3Rpb24gZ2VuZXJhdGVSYW5kb20oKSB7XG5cdC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xOTMwMzcyNVxuXHRjb25zdCB4ID0gTWF0aC5zaW4oc2VlZCsrKSAqIDEwMDAwMFxuXG5cdHJldHVybiB4IC0gTWF0aC5mbG9vcih4KVxufVxuXG5mdW5jdGlvbiByYW5kb21TaHVmZmxlKGRhdGEsIHNlZWQpIHtcblx0Y29uc3QgcmFuZG9tR2VuZXJhdG9yID0gY3JlYXRlUmFuZG9tR2VuZXJhdG9yKHNlZWQpXG5cdGNvbnN0IHNodWZmbGVkRGF0YSA9IFsuLi5kYXRhXVxuXHRzaHVmZmxlZERhdGEuc29ydCgoKSA9PiByYW5kb21HZW5lcmF0b3IoKSAtIHJhbmRvbUdlbmVyYXRvcigpKVxuXHRyZXR1cm4gc2h1ZmZsZWREYXRhXG59XG5cbmZ1bmN0aW9uIHNwbGl0RGF0YShkYXRhLCBwZXJjZW50YWdlID0gMC4yKSB7XG5cdGNvbnN0IGxlbiA9IE1hdGgudHJ1bmMoZGF0YS5sZW5ndGggKiBwZXJjZW50YWdlKVxuXG5cdGNvbnN0IHRyYWluRGF0YSA9IFsuLi5kYXRhXVxuXG5cdGNvbnN0IHRlc3REYXRhID0gWy4uLnRyYWluRGF0YS5zcGxpY2UoMCwgbGVuKV1cblxuXHRyZXR1cm4gW1xuXHRcdHRyYWluRGF0YSxcblx0XHR0ZXN0RGF0YSxcblx0XVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0Y2FsY0FjY3VyYWN5LCBnZXREYXRhQXNPYmplY3RzLCBzcGxpdERhdGEsIHJhbmRvbVNodWZmbGUsXG59XG4iLCJmdW5jdGlvbiBtb3ZlRGVjaXNpb25BdHRyaWJ1dGVUb0xhc3RDb2x1bW4oZGF0YSwgYXR0cmlidXRlcywgZGVjaXNpb25BdHRyaWJ1dGUpIHtcblx0Y29uc3QgaiA9IGF0dHJpYnV0ZXMuZmluZEluZGV4KGF0dHIgPT4gYXR0ciA9PT0gZGVjaXNpb25BdHRyaWJ1dGUpXG5cblx0Y29uc3QgbiA9IGF0dHJpYnV0ZXMubGVuZ3RoXG5cblx0aWYgKGogPT09IG4gLSAxKSByZXR1cm4geyBkYXRhLCBhdHRyaWJ1dGVzIH1cblxuXHRkYXRhID0gWy4uLmRhdGFdXG5cdGF0dHJpYnV0ZXMgPSBbLi4uZGF0YV1cblxuXHQ7W2RhdGFbal0sIGRhdGFbbiAtIDFdXSA9IFtkYXRhW24gLSAxXSwgZGF0YVtqXV1cblx0O1thdHRyaWJ1dGVzW2pdLCBhdHRyaWJ1dGVzW24gLSAxXV0gPSBbYXR0cmlidXRlc1tuIC0gMV0sIGF0dHJpYnV0ZXNbal1dXG5cblx0cmV0dXJuIHsgZGF0YSwgYXR0cmlidXRlcyB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VNaXNzaW5nRGF0YShkYXRhLCBtaXNzaW5nRGF0YVZhbHVlcykge1xuXHRyZXR1cm4gZGF0YS5tYXAocm93ID0+IHJvdy5tYXAodmFsdWUgPT4gKG1pc3NpbmdEYXRhVmFsdWVzLmluY2x1ZGVzKHZhbHVlKSA/IG51bGwgOiB2YWx1ZSkpKVxufVxuXG5mdW5jdGlvbiBjYXN0Q29sdW1uc1RvTnVtYmVyKGRhdGEsIGNvbHVtbkluZGV4ZXMpIHtcblx0cmV0dXJuIGRhdGEubWFwKHJvdyA9PiB7XG5cdFx0cm93ID0gWy4uLnJvd11cblx0XHRjb2x1bW5JbmRleGVzLmZvckVhY2goY29sSWR4ID0+IHtcblx0XHRcdHJvd1tjb2xJZHhdID0gTnVtYmVyKHJvd1tjb2xJZHhdKVxuXHRcdH0pXG5cdFx0cmV0dXJuIHJvd1xuXHR9KVxufVxuXG5mdW5jdGlvbiByZXBsYWNlRGVjaXNpb25BdHRyaWJ1dGVzV2l0aDAoZGF0YSwgcG9zaXRpdmVWYWx1ZXMpIHtcblx0cmV0dXJuIGRhdGEubWFwKHJvdyA9PiB7XG5cdFx0cm93ID0gWy4uLnJvd11cblx0XHRjb25zdCB2YWx1ZSA9IHJvd1tyb3cubGVuZ3RoIC0gMV1cblx0XHRyb3dbcm93Lmxlbmd0aCAtIDFdID0gdmFsdWUgPT09IHBvc2l0aXZlVmFsdWVzID8gMSA6IDBcblx0XHRyZXR1cm4gcm93XG5cdH0pXG59XG5cbmZ1bmN0aW9uIHByZXBhcmVEYXRhKHtcblx0ZGF0YTogb3JpZ0RhdGEsXG5cdGRlY2lzaW9uQXR0cmlidXRlLFxuXHRtaXNzaW5nRGF0YVZhbHVlcyxcblx0Y29udGludW9zQXR0cmlidXRlcyxcblx0cG9zaXRpdmVEZWNpc2lvblZhbHVlLFxuXHRyZW5hbWVEZWNpc2lvblRvID0gbnVsbCxcbn0pIHtcblx0bGV0IGF0dHJpYnV0ZXMgPSBvcmlnRGF0YVswXVxuXHRsZXQgZGF0YSA9IG9yaWdEYXRhLnNsaWNlKDEpXG5cblx0Oyh7IGRhdGEsIGF0dHJpYnV0ZXMgfSA9IG1vdmVEZWNpc2lvbkF0dHJpYnV0ZVRvTGFzdENvbHVtbihkYXRhLCBhdHRyaWJ1dGVzLCBkZWNpc2lvbkF0dHJpYnV0ZSkpXG5cdGRhdGEgPSByZXBsYWNlTWlzc2luZ0RhdGEoZGF0YSwgbWlzc2luZ0RhdGFWYWx1ZXMpXG5cblx0Y29uc3QgY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMgPSBjb250aW51b3NBdHRyaWJ1dGVzLm1hcChhdHRyID0+IGF0dHJpYnV0ZXMuZmluZEluZGV4KHYgPT4gdiA9PT0gYXR0cikpXG5cdGRhdGEgPSBjYXN0Q29sdW1uc1RvTnVtYmVyKGRhdGEsIGNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzKVxuXG5cdGRhdGEgPSByZXBsYWNlRGVjaXNpb25BdHRyaWJ1dGVzV2l0aDAoZGF0YSwgcG9zaXRpdmVEZWNpc2lvblZhbHVlKVxuXG5cdGlmIChyZW5hbWVEZWNpc2lvblRvKSBhdHRyaWJ1dGVzW2F0dHJpYnV0ZXMubGVuZ3RoIC0gMV0gPSByZW5hbWVEZWNpc2lvblRvXG5cblx0cmV0dXJuIHsgZGF0YSwgYXR0cmlidXRlcyB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJlcGFyZURhdGFcbiIsIm1vZHVsZS5leHBvcnRzID0gW1tcImFnZVwiLFwiY2hlc3RfcGFpbl90eXBlXCIsXCJyZXN0X2Jsb29kX3ByZXNzdXJlXCIsXCJibG9vZF9zdWdhclwiLFwicmVzdF9lbGVjdHJvXCIsXCJtYXhfaGVhcnRfcmF0ZVwiLFwiZXhlcmNpY2VfYW5naW5hXCIsXCJkaXNlYXNlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMzlcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDJcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIlRSVUVcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTE5XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjIwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTcwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTJcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjYwXCIsXCJhc3ltcHRcIixcIjEwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTQzXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY2XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNjBcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjEzNVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxMDZcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxOTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwNlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY2XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTU1XCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXN5bXB0XCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MVwiLFwibm9uX2FuZ2luYWxcIixcIjEzNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTlcIixcIm5vbl9hbmdpbmFsXCIsXCIxODBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMThcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTFcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5MlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzNcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDFcIixcImF0eXBfYW5naW5hXCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjE3MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMTJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTBcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCI4N1wiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NlwiLFwidHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE3NVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwibm9uX2FuZ2luYWxcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDRcIixcImF0eXBfYW5naW5hXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzJcIixcImF0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJub25fYW5naW5hbFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDNcIixcImF0eXBfYW5naW5hXCIsXCIxNDJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyOFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcInR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIj9cIixcIjEzNlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ5XCIsXCJub25fYW5naW5hbFwiLFwiMTE1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQ2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxMzRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM2XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwibm9uX2FuZ2luYWxcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzRcIixcImF0eXBfYW5naW5hXCIsXCI5OFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzFcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTNcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMjlcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjVcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMjlcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQzXCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIyXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzJcIixcImFzeW1wdFwiLFwiMTE4XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDNcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzlcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzMFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXR5cF9hbmdpbmFcIixcIjEwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIyOFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTg1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTFcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUxXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDJcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk5XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjMyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwibm9uX2FuZ2luYWxcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTI0XCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMTJcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTgwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxMjhcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxODBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNVwiLFwiYXR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTIyXCIsXCJUUlVFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI2MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDFcIixcImFzeW1wdFwiLFwiMTEyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjgyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM0XCIsXCJ0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQwXCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjdcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1OFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0N1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDBcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOThcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMTJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjY1XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM3XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJ0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzN1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM2XCIsXCJub25fYW5naW5hbFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTJcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiMzdcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjk4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTAwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXN5bXB0XCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTM2XCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI5OVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzhcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTNcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjYxXCIsXCJhc3ltcHRcIixcIjEyNVwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE1XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXR5cF9hbmdpbmFcIixcIjE3MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTE2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDVcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTI1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQzXCIsXCJ0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE1NVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxODBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1N1wiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjkyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ0XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzZcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ1XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzdcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzN1wiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ0XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTlcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNFwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTY4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTcwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjkyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNVwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcIm5vbl9hbmdpbmFsXCIsXCIxNjBcIixcIlRSVUVcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOTJcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyOFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzN1wiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTM0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcInR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjNcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1OVwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjExMlwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdXSIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuX193ZWJwYWNrX3JlcXVpcmVfXy5uID0gKG1vZHVsZSkgPT4ge1xuXHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cblx0XHQoKSA9PiAobW9kdWxlWydkZWZhdWx0J10pIDpcblx0XHQoKSA9PiAobW9kdWxlKTtcblx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgeyBhOiBnZXR0ZXIgfSk7XG5cdHJldHVybiBnZXR0ZXI7XG59OyIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgcHJlcGFyZURhdGEgZnJvbSAnLi4vZGF0YS1taW5pbmcvcHJlcGFyZURhdGEnXG5pbXBvcnQgeyByYW5kb21TaHVmZmxlLCBzcGxpdERhdGEgfSBmcm9tICcuLi9kYXRhLW1pbmluZy9kYXRhLXV0aWxzJ1xuXG5pbXBvcnQgY3JlYXRlSWQzQ2xhc3NpZmllciBmcm9tICcuLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMydcbmltcG9ydCBjcmVhdGVCYXllc0NsYXNzaWZpZXIgZnJvbSAnLi4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcydcblxuaW1wb3J0IGRhdGFzZXQgZnJvbSAnLi4vZGF0YS1taW5pbmcvaGVhcnRfZGlzZWFzZV9tYWxlLmNzdidcblxuY29uc3QgY29udGludW9zQXR0cmlidXRlcyA9IFsnYWdlJywgJ3Jlc3RfYmxvb2RfcHJlc3N1cmUnLCAnbWF4X2hlYXJ0X3JhdGUnXVxuXG5jb25zdCB7IGRhdGE6IG9yaWdpbmFsRGF0YSwgYXR0cmlidXRlcyB9ID0gcHJlcGFyZURhdGEoe1xuXHRkYXRhOiBkYXRhc2V0LFxuXHRjb250aW51b3NBdHRyaWJ1dGVzLFxuXHRkZWNpc2lvbkF0dHJpYnV0ZTogJ2Rpc2Vhc2UnLFxuXHRtaXNzaW5nRGF0YVZhbHVlczogWyc/JywgJyddLFxuXHRwb3NpdGl2ZURlY2lzaW9uVmFsdWU6ICdwb3NpdGl2ZScsXG5cdHJlbmFtZURlY2lzaW9uVG86ICdkZWNpc2lvbicsXG59KVxuXG4vLyBzaHVmZmxlIGFuZCBzcGxpdCB0byBtYXRjaCB0aGUgcmVwb3J0c1xuXG5jb25zdCBzaHVmZmxlZERhdGEgPSByYW5kb21TaHVmZmxlKG9yaWdpbmFsRGF0YSwgMSlcblxuY29uc3QgW3RyYWluRGF0YV0gPSBzcGxpdERhdGEoc2h1ZmZsZWREYXRhLCAwLjMwKVxudHJhaW5EYXRhLnVuc2hpZnQoYXR0cmlidXRlcy5zbGljZSgpKVxuXG5jb25zdCBpZDNDbGFzc2lmaWVyID0gY3JlYXRlSWQzQ2xhc3NpZmllcih0cmFpbkRhdGEsIGNvbnRpbnVvc0F0dHJpYnV0ZXMpXG5jb25zdCBiYXllc0NsYXNzaWZpZXIgPSBjcmVhdGVCYXllc0NsYXNzaWZpZXIodHJhaW5EYXRhLCBjb250aW51b3NBdHRyaWJ1dGVzKVxuXG5jb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmhlYXJ0LWRpYWdub3Npcy1mcm9tJylcbmNvbnN0IHJlc3VsdEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmhlYXJ0LWRpYWdub3Npcy1yZXN1bHQnKVxuY29uc3QgcmVzdWx0SWNvbiA9IHJlc3VsdEVsLnF1ZXJ5U2VsZWN0b3IoJy5oZWFydC1kaWFnbm9zaXMtcmVzdWx0IC5pY29uJylcblxucmVzdWx0SWNvbi5hZGRFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCAoKSA9PiB7XG5cdHJlc3VsdEljb24uY2xhc3NMaXN0LnJlbW92ZSgnYW5pbWF0ZScpXG59KVxuXG5mb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4ge1xuXHRyZXN1bHRFbC5jbGFzc0xpc3QucmVtb3ZlKCdzaG93Jylcblx0cmVzdWx0SWNvbi5jbGFzc0xpc3QucmVtb3ZlKCdhbmltYXRlJylcbn0pXG5cbmZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZSA9PiB7XG5cdGUucHJldmVudERlZmF1bHQoKVxuXHRjb25zdCBlbnRyaWVzID0gWy4uLm5ldyBGb3JtRGF0YShmb3JtKV1cblx0XHQuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9PSAnJylcblx0XHQubWFwKChbYXR0ciwgdmFsdWVdKSA9PiB7XG5cdFx0XHRpZiAoIWNvbnRpbnVvc0F0dHJpYnV0ZXMuaW5jbHVkZXMoYXR0cikpIHJldHVybiBbYXR0ciwgdmFsdWVdXG5cdFx0XHRyZXR1cm4gW2F0dHIsIE51bWJlcih2YWx1ZSldXG5cdFx0fSlcblx0Y29uc3QgZGF0YU9iamVjdCA9IE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKVxuXHRjb25zb2xlLmxvZyhkYXRhT2JqZWN0KVxuXG5cdGxldCByZXN1bHRcblxuXHRpZiAoZGF0YU9iamVjdC5hbGdvcml0aG0gPT09ICdpZDMnKSB7XG5cdFx0cmVzdWx0ID0gaWQzQ2xhc3NpZmllci5jbGFzc2lmeShkYXRhT2JqZWN0KVxuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9IGJheWVzQ2xhc3NpZmllci5jbGFzc2lmeShkYXRhT2JqZWN0KVxuXHR9XG5cblx0Y29uc29sZS5sb2cocmVzdWx0KVxuXHRjb25zdCB7IGRlY2lzaW9uIH0gPSByZXN1bHRcblx0cmVzdWx0RWwuY2xhc3NMaXN0LnJlbW92ZSgncG9zaXRpdmUnLCAnbmVnYXRpdmUnKVxuXHRyZXN1bHRFbC5jbGFzc0xpc3QuYWRkKCdzaG93JywgWyduZWdhdGl2ZScsICdwb3NpdGl2ZSddW2RlY2lzaW9uXSlcblx0cmVzdWx0SWNvbi5jbGFzc0xpc3QuYWRkKCdhbmltYXRlJylcbn0pXG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=