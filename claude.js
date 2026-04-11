import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function run() {
    const response = await client.messages.create({
        model: "claude-3-sonnet-20240229", // working model
        max_tokens: 300,
        messages: [
            {
                role: "user",
                content: "Create a journal entry for purchasing equipment on credit"
            }
        ],
    });

    console.log(response.content[0].text);
}

run();