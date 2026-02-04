import { db } from '@/src/db/db';
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod/v4';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  // stopWhen  = stepCountIs(5);
  const SYSTEM_PROMPT = `You are an expert SQL assistant that helps users to query their database using natural language.

  ${new Date().toLocaleString('sv-SE')}

You have access to following tools:
1. schema tool - call this tool to get the database schema which will help you to write sql query.
2. db tool - call this tool to query the database.

Rules:
- Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP)
- Always use the schema provided by the schema tool
- Return valid SQLite syntax

Always respond in a helpful, conversational tone while being technically accurate.`;


  const result = streamText({
    model: "openai/gpt-5.2-codex",
    messages: await convertToModelMessages(messages),
    system:SYSTEM_PROMPT,
    stopWhen: stepCountIs(5),
        tools: {
      db: tool({
        description: 'Call this tool to query a database',
        inputSchema: z.object({
          query: z.string().describe('The SQL query to be ran'),
        }),
        execute: async ({query})=>{
            // console.log('Query',query);
            return await db.run(query);
        }
      }),
      schema: tool({
        description: 'Call this tool to get database information',
        inputSchema: z.object({}),
        execute: async ()=>{
            return `
    CREATE TABLE products (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	category text NOT NULL,
	price real NOT NULL,
	stock integer DEFAULT 0 NOT NULL,
	created_at text DEFAULT CURRENT_TIMESTAMP
)
CREATE TABLE sales (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	product_id integer NOT NULL,
	quantity integer NOT NULL,
	total_amount real NOT NULL,
	sale_date text DEFAULT CURRENT_TIMESTAMP,
	customer_name text NOT NULL,
	region text NOT NULL,
	FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE no action
)
            `;
        }
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}