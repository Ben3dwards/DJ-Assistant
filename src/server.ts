import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
    searchTracks,
    searchTracksDescription,
    searchTracksInputSchema,
} from "./tools/searchTracks.js";

import {
    recommendFromTrack,
    recommendFromTrackDescription,
    recommendFromTrackInputSchema,
} from "./tools/recommendFromTrack.js";

import {
    generateSetlist,
    generateSetlistDescription,
    generateSetlistInputSchema,
} from "./tools/generateSetlist.js";

import {
    exportSetlistToSpotify,
    exportSetlistToSpotifyDescription,
    exportSetlistToSpotifyInputSchema,
} from "./tools/exportSetlistToSpotify.js";

//Create the MCP server
const server = new McpServer({
    name: "dj-assistant-v2",
    version: "1.0.0",
});

//Register search_tracks tool
server.registerTool(
    "search_tracks",
    {
        description: searchTracksDescription,
        inputSchema: searchTracksInputSchema,
    },
    searchTracks
);

// Register recommend_from_track tool
server.registerTool(
    "recommend_from_track",
    {
        description: recommendFromTrackDescription,
        inputSchema: recommendFromTrackInputSchema,
    },
    recommendFromTrack
);

//Register generate_setlist tool
server.registerTool(
    "generate_setlist",
    {
        description: generateSetlistDescription,
        inputSchema: generateSetlistInputSchema,
    },
    generateSetlist
);

//Register export_setlist_to_spotify tool
server.registerTool(
    "export_setlist_to_spotify",
    {
        description: exportSetlistToSpotifyDescription,
        inputSchema: exportSetlistToSpotifyInputSchema,
    },
    exportSetlistToSpotify
);

async function main() {
    const transport = new StdioServerTransport();

    await server.connect(transport);

    //MCP documentation recommends console.error for server-side logging
    //as console.log writes to stdout which is reserved for the MCP stdio protocol
    console.error("DJ Assistant MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});