function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

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

export {randomChoice, extractLinesAtPoint}