const createNaiveBayesClassifier = require('.')

describe('naive-bayes', () => {
	it.only('works: test data #1', () => {
		const data = [
			['outlook', 'temperature', 'humidity', 'wind', 'decision'],
			['sunny', 85, 85, 'false', 0],
			['sunny', 80, 90, 'true', 0],
			['overcast', 83, 86, 'false', 1],
			['rain', 70, 96, 'false', 1],
			['rain', 68, 80, 'false', 1],
			['rain', 65, 70, 'true', 0],
			['overcast', 64, 65, 'true', 1],
			['sunny', 72, 95, 'false', 0],
			['sunny', 69, 70, 'false', 1],
			['rain', 75, 80, 'false', 1],
			['sunny', 75, 70, 'true', 1],
			['overcast', 72, 90, 'true', 1],
			['overcast', 81, 75, 'false', 1],
			['rain', 71, 91, 'true', 0],
		]
		const classifier = createNaiveBayesClassifier(data, ['temperature', 'humidity'])
		const probs = classifier.classify({
			outlook: 'overcast',
			temperature: 66,
			humidity: 90,
			wind: 'true',
		})

		expect(probs[0]).toBeCloseTo(0.26984516938841646, 13)
		expect(probs[1]).toBeCloseTo(0.7301548306115835, 13)
		expect(probs.decision).toBe(1)
	})
})
