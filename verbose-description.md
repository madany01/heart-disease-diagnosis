# Heart Disease Prediction using Naive Bayes & ID3 Algorithms

The project implements Naive Bayes and ID3 decision tree algorithms providing probabilistic outputs and explainable predictions.
It handle datasets with discrete/continuous and missing values.

The algorithms is then used to build heart disease prediction.

Dependencies: None.

## Naive Bayes

O(n) training complexity
Returns the decision as well as normalized class probabilities

- Probabilistic Modeling:
  - Discrete attributes: Laplace-smoothed frequency analysis
  - Continuous attributes: Gaussian distribution modeling

### Laplace Estimator

zero probabilities are prevented with laplace estimator `P(xi/yi) = (nc + 1) / (n + u)`

- nc: # samples when x=xi and y=yi
- n: # samples when y=yi
- u: # unique values of the feature

e.g. if feature f has possible values of (A, B, C), and:

| decision | yes | no  |
| -------- | --- | --- |
| A        | 2   | 3   |
| B        | 4   | 0   |
| C        | 3   | 2   |
| ------   |     |     |
| sum      | 9   | 5   |

so instead of P(f=B/no) = 0/5 = 0
it become P(f=B/no) = (0+1)/(5+3) = 1/8

where:

- nc=0 (# samples when decision is no and f is B)
- u=3 (# unique values for feature f, which is A, B, C)
- n=5 (# samples when decision is no)

### Missing values

Automatic missing-values handling during training and predictions

- on training, ignore the missing feature when calculating the frequencies for discrete features, and mu/sigma2 for continuous ones.
- on prediction, assume the feature doesn't exist (e.g. probability is set to 1 of that feature).

## ID3 Decision Tree

### Metric

during tree construction, Gain Ratio was used to select the most important features.
(Info Gain would bias for features with more unique values)

### Tree Introspection

the implementation returns tree graph allowing introspection of al whole tree structure.

the decision path chosen for a prediction is also returned when classifying, explaining the choices made.

```js
const data = ...
const continuosAttributesNames = ...

const id3Classifier = createId3Classifier(data, continuosAttributesNames)
console.log(id3Classifier.getRootNode())
/*
{
  decisionsFrequency: [ 85, 62 ],
  mostFrequentDecision: 0,
  gainRatio: 0.23908330626189814,
  attribute: 'exercice_angina',
  attributeValuesFrequencies: Map(2) { 'no' => 100, 'yes' => 47 },
  mostFrequentAttributeValue: 'no',
  isContinuous: false
}
*/

console.log(id3Classifier.getRootNode().getAdjacentNodes().get('yes').getNodeInfo())
/*
{
  decisionsFrequency: [ 9, 38 ],
  mostFrequentDecision: 1,
  gainRatio: 0.3512692839384108,
  attribute: 'max_heart_rate',
  attributeValuesFrequencies: Map(2) { true => 46, false => 1 },
  mostFrequentAttributeValue: true,
  isContinuous: true,
  threshold: 159
}
*/

const objectToBeClassified = { ... }
console.log(id3Classifier.classify(objectToBeClassified))
/*
{
  decision: 1,
  path: [ 'exercice_angina', 'max_heart_rate', 'chest_pain_type' ]
}
*/
```

### Missing Values

- during training: frequency-based random sampling was used
  for example if feature 'f' has 110 values, 10 of them are missing, and the remaining are:
  valueA (50 times)
  ValueB (30 times)
  ValueC (20 times)
  those 10 missing values will be chosen from [valueA, valueB, valueC] so that:
  P(missingValue = ValueA) = 50%
  P(missingValue = ValueB) = 30%
  P(missingValue = ValueC) = 20%
- during prediction: we choose the most repeated value **per this node only (not per the whole given dataset)**

### Continuous Values

at each node during constructing the tree, continuous values for a feature are converted to boolean after finding an optimal threshold (if value <= threshold then true else false)

the candidate thresholds of a feature are calculated after finding the unique sorted values of that feature, and then taking each in-between value as a threshold. then, of all those thresholds, we choose the one that results in making the feature makes the highest gain ration.

for instance, if a feature has those values [20, 10, 30, 40, 40, 10, 20]
sorted Unique Attribute Values = [10, 20, 30, 40]
candidate thresholds = [(10+20)/2, (20+30)/2, (30+40)/2] = [15, 25, 35]

### tree pruning

![tree pruning](./screenshots/tree-pruning.png)

the implementation automatically prune the tree during training, make it more efficient. for instance, the above image shows how all paths after a node (e.g. rest blood pressure) end up with a negative prediction. therefore, all this subtree is compressed into single leaf node with a negative prediction.

### Redundant Features

redundant features are dropped repeatedly in every step while creating the tree.

## Example

with 70/30 train/test split, the accuracy on the used dataset are:

|             |     | training | testing |
| ----------- | --- | -------- | ------- |
| naive bayes |     | 80.3%    | 79%     |
| id3         |     | 83.7%    | 80.6%   |

on id3:

- number of non-leaves are 11
- number of leaves are 16
