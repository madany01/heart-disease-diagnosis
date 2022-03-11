const createId3Classifier = require('.')

describe('id3', () => {
	it('works when data has only 1 attribute', () => {
		const data = [
			['outlook', 'decision'],
			['cold', 0],
			['cold', 1],
			['cold', 1],
			['cool', 0],
			['cool', 0],
			['hot', 1],
		]
		const classifier = createId3Classifier(data)
		let result = classifier.classify({ outlook: 'cold' })
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook'])

		result = classifier.classify({ outlook: 'cool' })
		expect(result.decision).toBe(0)
		expect(result.path).toEqual(['outlook'])

		result = classifier.classify({ outlook: 'hot' })
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook'])
	})

	it('works: test data #1', () => {
		const data = [
			['outlook', 'temperature', 'humidity', 'wind', 'decision'],
			['sunny', 'hot', 'high', 'weak', 0],
			['sunny', 'hot', 'high', 'strong', 0],
			['overcast', 'hot', 'high', 'weak', 1],
			['rain', 'mild', 'high', 'weak', 1],
			['rain', 'cool', 'normal', 'weak', 1],
			['rain', 'cool', 'normal', 'strong', 0],
			['overcast', 'cool', 'normal', 'strong', 1],
			['sunny', 'mild', 'high', 'weak', 0],
			['sunny', 'cool', 'normal', 'weak', 1],
			['rain', 'mild', 'normal', 'weak', 1],
			['sunny', 'mild', 'normal', 'strong', 1],
			['overcast', 'mild', 'high', 'strong', 1],
			['overcast', 'hot', 'normal', 'weak', 1],
			['rain', 'mild', 'high', 'strong', 0],
		]
		const classifier = createId3Classifier(data)

		let result = classifier.classify({
			outlook: 'sunny',
			humidity: 'normal',
		})
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook', 'humidity'])

		result = classifier.classify({
			outlook: 'sunny',
			humidity: 'high',
		})
		expect(result.decision).toBe(0)
		expect(result.path).toEqual(['outlook', 'humidity'])

		result = classifier.classify({
			outlook: 'overcast',
		})
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook'])

		result = classifier.classify({
			outlook: 'rain',
			wind: 'weak',
		})
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook', 'wind'])

		result = classifier.classify({
			outlook: 'rain',
			wind: 'strong',
		})
		expect(result.decision).toBe(0)
		expect(result.path).toEqual(['outlook', 'wind'])
	})

	it('returns correct tree with correct info', () => {
		const data = [
			['outlook', 'temperature', 'humidity', 'wind', 'decision'],
			['sunny', 'hot', 'high', 'weak', 0],
			['sunny', 'hot', 'high', 'strong', 0],
			['overcast', 'hot', 'high', 'weak', 1],
			['rain', 'mild', 'high', 'weak', 1],
			['rain', 'cool', 'normal', 'weak', 1],
			['rain', 'cool', 'normal', 'strong', 0],
			['overcast', 'cool', 'normal', 'strong', 1],
			['sunny', 'mild', 'high', 'weak', 0],
			['sunny', 'cool', 'normal', 'weak', 1],
			['rain', 'mild', 'normal', 'weak', 1],
			['sunny', 'mild', 'normal', 'strong', 1],
			['overcast', 'mild', 'high', 'strong', 1],
			['overcast', 'hot', 'normal', 'weak', 1],
			['rain', 'mild', 'high', 'strong', 0],
		]
		const classifier = createId3Classifier(data)
		const rootNode = classifier.getRootNode()

		expect(classifier.getTreeNodes().size).toBe(8)

		expect(rootNode.getNodeInfo().attribute).toEqual('outlook')
		expect(rootNode.getNodeInfo().infoGain).toBeCloseTo(0.247)

		const humidityNode = rootNode.getAdjacentNodes().get('sunny')
		expect(humidityNode.getNodeInfo().attribute).toEqual('humidity')
		expect(humidityNode.getNodeInfo().infoGain).toBeCloseTo(0.971)

		const windNode = rootNode.getAdjacentNodes().get('rain')
		expect(windNode.getNodeInfo().attribute).toEqual('wind')
		expect(windNode.getNodeInfo().infoGain).toBeCloseTo(0.971)

		const outlookLeaf = rootNode.getAdjacentNodes().get('overcast')
		expect(outlookLeaf.isLeaf()).toBe(true)
		expect(outlookLeaf.getNodeInfo().decision).toBe(1)

		const humidityLeafHigh = humidityNode.getAdjacentNodes().get('high')
		expect(humidityLeafHigh.isLeaf()).toBe(true)
		expect(humidityLeafHigh.getNodeInfo().decision).toBe(0)

		const humidityLeafNormal = humidityNode.getAdjacentNodes().get('normal')
		expect(humidityLeafNormal.isLeaf()).toBe(true)
		expect(humidityLeafNormal.getNodeInfo().decision).toBe(1)

		const windLeafStrong = windNode.getAdjacentNodes().get('strong')
		expect(windLeafStrong.isLeaf()).toBe(true)
		expect(windLeafStrong.getNodeInfo().decision).toBe(0)

		const windLeafWeak = windNode.getAdjacentNodes().get('weak')
		expect(windLeafWeak.isLeaf()).toBe(true)
		expect(windLeafWeak.getNodeInfo().decision).toBe(1)
	})

	it('gives the right results on the training data', () => {
		const data = [
			['outlook', 'temperature', 'humidity', 'wind', 'decision'],
			['sunny', 'hot', 'high', 'weak', 0],
			['sunny', 'hot', 'high', 'strong', 0],
			['overcast', 'hot', 'high', 'weak', 1],
			['rain', 'mild', 'high', 'weak', 1],
			['rain', 'cool', 'normal', 'weak', 1],
			['rain', 'cool', 'normal', 'strong', 0],
			['overcast', 'cool', 'normal', 'strong', 1],
			['sunny', 'mild', 'high', 'weak', 0],
			['sunny', 'cool', 'normal', 'weak', 1],
			['rain', 'mild', 'normal', 'weak', 1],
			['sunny', 'mild', 'normal', 'strong', 1],
			['overcast', 'mild', 'high', 'strong', 1],
			['overcast', 'hot', 'normal', 'weak', 1],
			['rain', 'mild', 'high', 'strong', 0],
		]
		const classifier = createId3Classifier(data)
		const samples = data
			.slice(1)
			.map(row => row.reduce((acc, value, idx) => {
				acc[data[0][idx]] = value
				return acc
			}, {}))

		samples.forEach(sample => {
			const sampleToSend = { ...sample }
			delete sampleToSend.decision
			expect(classifier.classify(sampleToSend).decision).toBe(sample.decision)
		})
	})

	it('works with continuous and discrete values', () => {
		const data = [
			['outlook', 'temperature', 'humidity', 'wind', 'decision'],
			['sunny',	'hot', 	0.9, 'false', 0],
			['sunny',	'hot', 	0.87, 'true', 0],
			['overcast',	'hot', 	0.93, 'false', 1],
			['rain',	'mild', 	0.89, 'false', 1],
			['rain',	'cool', 	0.80, 'false', 1],
			['rain',	'cool', 	0.59, 'true', 0],
			['overcast',	'cool', 	0.77, 'true', 1],
			['sunny',	'mild', 	0.91, 'false', 0],
			['sunny',	'cool', 	0.68, 'false', 1],
			['rain',	'mild', 	0.84, 'false', 1],
			['sunny',	'mild', 	0.72, 'true', 1],
			['overcast',	'mild', 	0.49, 'true', 1],
			['overcast',	'hot', 	0.74, 'false', 1],
			['rain',	'mild', 	0.86, 'true', 0],
		]
		const classifier = createId3Classifier(data, ['humidity'])

		let result = classifier.classify({
			outlook: 'overcast',
		})
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook'])

		result = classifier.classify({
			outlook: 'rain',
			wind: 'true',
		})
		expect(result.decision).toBe(0)
		expect(result.path).toEqual(['outlook', 'wind'])

		result = classifier.classify({
			outlook: 'rain',
			wind: 'false',
		})
		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook', 'wind'])

		const humidityThreshold = classifier.getRootNode().getAdjacentNodes().get('sunny').getNodeInfo().threshold
		expect(humidityThreshold).toBeCloseTo((0.72 + 0.87) / 2, 9)

		result = classifier.classify({
			outlook: 'sunny',
			humidity: humidityThreshold - 1e-8,
		})

		expect(result.decision).toBe(1)
		expect(result.path).toEqual(['outlook', 'humidity'])

		result = classifier.classify({
			outlook: 'sunny',
			humidity: humidityThreshold + 1e-8,
		})
		expect(result.decision).toBe(0)
		expect(result.path).toEqual(['outlook', 'humidity'])
	})
})
