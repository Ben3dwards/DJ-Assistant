import Anthropic from "@anthropic-ai/sdk";
import type {
    MessageParam,
    Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { StoredSetlist } from "./state/sessionState.js";

export class DJMcpClient {
    private anthropic: Anthropic;
    private mcp: Client;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];

    //Only store user/assistant text here - never tool_use or tool_result blocks
    private messages: MessageParam[] = [];

    private latestSetlist: StoredSetlist | null = null;

    private readonly systemPrompt = `
        You are DJ Assistant.

        You have access to MCP tools for searching tracks, generating setlists, recommending tracks, and exporting setlists to Spotify.

        CRITICAL RULES - you must follow these exactly:
        - ALWAYS use tools. Never answer from memory or make up results.
        - When the user says yes, yeah, sure, ok, please, go ahead, or anything affirmative in response to being asked about Spotify — you MUST call export_setlist_to_spotify immediately. No exceptions.
        - Never tell the user a playlist was created unless export_setlist_to_spotify actually ran and returned success.
        - When generating a setlist, ALWAYS call generate_setlist. Never invent track lists.
        - If asked to generate and export in the same message, call generate_setlist first, then export_setlist_to_spotify.

        You are not allowed to respond to requests about setlists or Spotify without calling the appropriate tool first.
    `;

    constructor() {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("ANTHROPIC_API_KEY is not set.");
        }

        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        this.mcp = new Client({
            name: "dj-assistant-web-client",
            version: "1.0.0",
        });
    }

    async connectToServer() {
        if (this.transport) return;

        this.transport = new StdioClientTransport({
            command: "node",
            args: ["build/server.js"],
        });

        await this.mcp.connect(this.transport);

        const toolsResult = await this.mcp.listTools();

        this.tools = toolsResult.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
        }));

        console.error(
            "Connected to MCP tools:",
            this.tools.map((tool) => tool.name)
        );
    }

    getLatestSetlist() {
        return this.latestSetlist;
    }

    private rememberLatestSetlist(toolName: string, toolResult: any) {
        if (toolName !== "generate_setlist") return;

        try {
            const textContent = toolResult.content?.find(
                (item: any) => item.type === "text"
            )?.text;

            if (!textContent) return;

            const parsed = JSON.parse(textContent);

            if (!parsed.setlist) return;

            this.latestSetlist = {
                tracks: parsed.setlist.map((track: any) => ({
                    spotifyID: track.spotifyID,
                    name: track.name,
                    artists: track.artists,
                    spotifyUrl: track.spotifyUrl,
                })),
            };

            console.error(
                `Stored latest setlist with ${this.latestSetlist.tracks.length} tracks`
            );
        } catch (error) {
            console.error("Could not store latest setlist:", error);
        }
    }

    async processQuery(query: string) {
        this.messages.push({
            role: "user",
            content: query,
        });

        this.messages = this.messages.slice(-20);

        //Working message history for this turn — separate from stored this.messages
        //tool_use and tool_result blocks must be included in API calls but
        //should not be permanently stored in this.messages
        let currentMessages: MessageParam[] = [...this.messages];
        const finalText: string[] = [];

        // Agentic loop — keeps going until Claude stops calling tools
        while (true) {
            const response = await this.anthropic.messages.create({
                model: "claude-haiku-4-5",
                max_tokens: 1500,
                system: this.systemPrompt,
                messages: currentMessages,
                tools: this.tools,
            });

            //Collect any text blocks from this response
            for (const block of response.content) {
                if (block.type === "text") {
                    finalText.push(block.text);
                }
            }

            //If Claude is done calling tools, break out of the loop
            if (response.stop_reason !== "tool_use") {
                break;
            }

            //Run every tool Claude requested
            const toolResults = [];

            for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                const toolResult = await this.mcp.callTool({
                    name: block.name,
                    arguments: block.input as Record<string, unknown>,
                });

                this.rememberLatestSetlist(block.name, toolResult);

                toolResults.push({
                    type: "tool_result" as const,
                    tool_use_id: block.id,
                    content: JSON.stringify(toolResult.content),
                });
            }

            //Append assistant response and tool results, then loop again
            currentMessages = [
                ...currentMessages,
                { role: "assistant" as const, content: response.content },
                { role: "user" as const, content: toolResults },
            ];
        }

        const finalReply = finalText.join("\n");

        this.messages.push({
            role: "assistant",
            content: finalReply,
        });

        this.messages = this.messages.slice(-20);

        return finalReply;
    }

    async close() {
        await this.mcp.close();
    }
}