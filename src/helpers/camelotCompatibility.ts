//Retruns true if two camelot keys mix well
//Basic harmonic mixing rules:

export function isCamelotCompatible(source: string, target: string): boolean {
    const sourceNumber = Number(source.slice(0, -1));
    const sourceLetter = source.slice(-1);

    const targetNumber = Number(target.slice(0, -1));
    const targetLetter = target.slice(-1);

    if (source === target){
        return true;
    }

    //same number, A/B switch
    if (sourceNumber === targetNumber && sourceLetter !== targetLetter){
        return true;
    }

    //same letter, 1 number up and down
    if (sourceLetter === targetLetter){
        const up = sourceNumber === 12 ? 1: sourceNumber + 1;
        const down = sourceNumber === 1 ? 12: sourceNumber - 1;

        return targetNumber === up || targetNumber === down;
    }

    return false;
}