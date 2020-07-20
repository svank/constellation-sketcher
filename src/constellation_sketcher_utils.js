function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Accepts an object where the keys are items and the values are weights.
 * Returns one randomly-selected item.
 */
function randomWeightedChoice(itemWeightsMapping) {
    let sumOfWeights = 0;
    for (const item in itemWeightsMapping)
        sumOfWeights += itemWeightsMapping[item];
    
    let choice = Math.random() * sumOfWeights;
    for (const item in itemWeightsMapping) {
        if (itemWeightsMapping[item] >= choice) {
            return item;
        }
        choice -= itemWeightsMapping[item];
    }
}

/**
 * Given a set of lines (start and end points), returns all lines which start
 * or end at a given coordinate.
 */
function extractLinesAtPoint(lines, x, y) {
    const extractedLines = []
    lines = lines.filter((line) => {
        if (line.x1 === x && line.y1 === y){
            extractedLines.push(line)
            return false;
        } else if (line.x2 === x && line.y2 === y) {
            line = {x1: line.x2, y1: line.y2, x2: line.x1, y2: line.y1};
            extractedLines.push(line)
            return false;
        }
        return true;
    });
    return [extractedLines, lines];
}

export {randomChoice, randomWeightedChoice, extractLinesAtPoint}