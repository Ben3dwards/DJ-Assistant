//This helper converts the musical key into camelot notation
//For example: C# major = 3B on the camelot wheel

export function toCamelot(key: string, mode:0 | 1): string | null {
    const normalisedKey = key.trim().replace("♯", "#").replace("♭", "b"); //might get rid of as all keys only use # in database

    //mode 0 = Minor = A
    //mode 1 = Major = B
    const camelotMap: Record<string, {minor: string; major: string}> ={
        "Ab" : { minor: "1A", major: "4B"},
        "G#" : { minor: "1A", major: "4B"},

        "Eb": { minor: "2A", major: "5B" },
        "D#": { minor: "2A", major: "5B" },


        "Bb": { minor: "3A", major: "6B" },
        "A#": { minor: "3A", major: "6B" },

        "F": { minor: "4A", major: "7B" },
        "C": { minor: "5A", major: "8B" },
        "G": { minor: "6A", major: "9B" },
        "D": { minor: "7A", major: "10B" },
        "A": { minor: "8A", major: "11B" },
        "E": { minor: "9A", major: "12B" },
        "B": { minor: "10A", major: "1B" },

        "F#": { minor: "11A", major: "2B" },
        "Gb": { minor: "11A", major: "2B" },

        "C#": { minor: "12A", major: "3B" },
        "Db": { minor: "12A", major: "3B" },
    };

    const match = camelotMap[normalisedKey];

    if (!match){
        return null;
    }

    return mode ===1 ? match.major : match.minor;
}