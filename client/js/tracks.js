const trackNameInput = document.getElementById("search-track");
const artistInput = document.getElementById("search-artist");
const tableBody = document.getElementById("track-table-body");
const trackCount = document.getElementById("track-count");

let allTracks = [];
let sortColumn = null;
let sortDirection = "asc";

async function loadTracks() {
    const response = await fetch("/api/tracks");
    allTracks = await response.json();
    renderTracks(allTracks);
}

function renderTracks(tracks) {
    trackCount.textContent = `${tracks.length} tracks`;

    if (!tracks.length) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading">No tracks found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = tracks.map((track) => {
        const year = track.release_date
            ? new Date(track.release_date).getFullYear()
            : "—";

        const bpm = track.tempo ? Math.round(track.tempo) : "—";
        const energy = track.energy ? track.energy.toFixed(2) : "—";
        const spotify = track.spotify_URL
            ? `<a href="${track.spotify_URL}" target="_blank" rel="noopener">Link</a>`
            : "—";

        return `
            <tr>
                <td>${track.track_name}</td>
                <td>${track.track_artists}</td>
                <td>${year}</td>
                <td>${bpm}</td>
                <td>${track.key_sig}</td>
                <td>${energy}</td>
                <td>${spotify}</td>
            </tr>
        `;
    }).join("");
}

function sortTracks(tracks, column) {
    return [...tracks].sort((a, b) => {
        let valA, valB;

        if (column === "track_name") {
            valA = a.track_name.toLowerCase();
            valB = b.track_name.toLowerCase();
        } else if (column === "track_artists") {
            valA = a.track_artists.toLowerCase();
            valB = b.track_artists.toLowerCase();
        } else if (column === "year") {
            valA = a.release_date ? new Date(a.release_date).getFullYear() : 0;
            valB = b.release_date ? new Date(b.release_date).getFullYear() : 0;
        } else if (column === "energy") {
            valA = a.energy ?? 0;
            valB = b.energy ?? 0;
        } else if (column === "tempo") {
            valA = a.tempo ?? 0;
            valB = b.tempo ?? 0;
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });
}

function updateSortIndicators() {
    document.querySelectorAll("thead th[data-column]").forEach((th) => {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.dataset.column === sortColumn) {
            th.classList.add(sortDirection === "asc" ? "sort-asc" : "sort-desc");
        }
    });
}

function getFilteredTracks() {
    const nameQuery = trackNameInput.value.toLowerCase();
    const artistQuery = artistInput.value.toLowerCase();

    return allTracks.filter((track) => {
        const matchesName = track.track_name.toLowerCase().includes(nameQuery);
        const matchesArtist = track.track_artists.toLowerCase().includes(artistQuery);
        return matchesName && matchesArtist;
    });
}

function refresh() {
    let tracks = getFilteredTracks();
    if (sortColumn) {
        tracks = sortTracks(tracks, sortColumn);
    }
    renderTracks(tracks);
    updateSortIndicators();
}

document.querySelectorAll("thead th[data-column]").forEach((th) => {
    th.addEventListener("click", () => {
        const column = th.dataset.column;
        if (sortColumn === column) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortColumn = column;
            sortDirection = "asc";
        }
        refresh();
    });
});

trackNameInput.addEventListener("input", refresh);
artistInput.addEventListener("input", refresh);

loadTracks();