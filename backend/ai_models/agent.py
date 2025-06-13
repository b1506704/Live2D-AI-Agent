import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
import json
import asyncio
from config import settings
from .llm_manager import LLMManager

logger = logging.getLogger(__name__)

class AgentExecutor:
    """Executes agentic tasks with tool usage capabilities"""
    
    def __init__(self, llm_manager: LLMManager):
        self.llm = llm_manager
        self.tools: Dict[str, Callable] = {}
        self.execution_history: List[Dict[str, Any]] = []
        self._register_default_tools()
    
    def _register_default_tools(self):
        """Register default tools available to the agent"""
        
        # Web search tool
        self.register_tool(
            name="web_search",
            description="Search the web for information",
            func=self._web_search_tool
        )
        
        # Calculator tool
        self.register_tool(
            name="calculator",
            description="Perform mathematical calculations",
            func=self._calculator_tool
        )
        
        # Time/Date tool
        self.register_tool(
            name="get_current_time",
            description="Get the current date and time",
            func=self._time_tool
        )
        
        # Weather tool
        self.register_tool(
            name="get_weather",
            description="Get weather information for a location",
            func=self._weather_tool
        )
        
        # File operations
        self.register_tool(
            name="read_file",
            description="Read contents of a file",
            func=self._read_file_tool
        )
        
        self.register_tool(
            name="write_file",
            description="Write content to a file",
            func=self._write_file_tool
        )
        
        # System information
        self.register_tool(
            name="get_system_info",
            description="Get system information",
            func=self._system_info_tool
        )
    
    def register_tool(self, name: str, description: str, func: Callable):
        """Register a new tool for the agent to use"""
        self.tools[name] = {
            "name": name,
            "description": description,
            "func": func
        }
        logger.info(f"Registered tool: {name}")
    
    async def execute_task(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        max_iterations: Optional[int] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Execute an agentic task with tool usage
        
        Args:
            task: The task to execute
            context: Additional context for the task
            max_iterations: Maximum number of iterations
            language: Language for responses
            
        Returns:
            Execution results
        """
        max_iter = max_iterations or settings.max_agent_iterations
        iterations = 0
        task_completed = False
        results = []
        
        # Create system prompt for the agent
        system_prompt = f"""You are {settings.agent_name}, {settings.agent_personality}.
You have access to various tools to help complete tasks.
When you need to use a tool, you will receive the results and can continue with the task.
Be thorough but efficient. If you cannot complete a task, explain why."""
        
        # Initialize conversation history
        conversation = []
        if context:
            conversation.append({
                "role": "system",
                "content": f"Context: {json.dumps(context)}"
            })
        
        conversation.append({
            "role": "user",
            "content": task
        })
        
        while iterations < max_iter and not task_completed:
            iterations += 1
            
            try:
                # Get tool list for the LLM
                tool_list = [
                    {"name": name, "description": info["description"]}
                    for name, info in self.tools.items()
                ]
                
                # Generate response with tool usage
                response = self.llm.generate_with_tools(
                    prompt=self._format_conversation(conversation),
                    tools=tool_list,
                    system_prompt=system_prompt,
                    language=language
                )
                
                # Add assistant response to conversation
                conversation.append({
                    "role": "assistant",
                    "content": response["response"]
                })
                
                # Process tool calls
                if response["tool_calls"]:
                    for tool_call in response["tool_calls"]:
                        tool_result = await self._execute_tool(tool_call)
                        
                        # Add tool result to conversation
                        conversation.append({
                            "role": "tool",
                            "content": f"Tool '{tool_call.get('tool')}' result: {tool_result}"
                        })
                        
                        results.append({
                            "tool": tool_call.get("tool"),
                            "parameters": tool_call.get("parameters"),
                            "result": tool_result
                        })
                else:
                    # No more tool calls, task might be completed
                    task_completed = True
                
                # Check if the response indicates completion
                completion_keywords = ["completed", "finished", "done", "accomplished"]
                if any(keyword in response["response"].lower() for keyword in completion_keywords):
                    task_completed = True
                    
            except Exception as e:
                logger.error(f"Error in task execution: {e}")
                conversation.append({
                    "role": "error",
                    "content": str(e)
                })
                break
        
        # Record execution history
        execution_record = {
            "task": task,
            "timestamp": datetime.now().isoformat(),
            "iterations": iterations,
            "completed": task_completed,
            "results": results,
            "conversation": conversation,
            "language": language
        }
        self.execution_history.append(execution_record)
        
        return {
            "completed": task_completed,
            "response": conversation[-1]["content"] if conversation else "",
            "iterations": iterations,
            "tool_results": results,
            "conversation": conversation
        }
    
    def _format_conversation(self, conversation: List[Dict[str, str]]) -> str:
        """Format conversation history for the LLM"""
        formatted = []
        for msg in conversation:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
            elif role == "tool":
                formatted.append(f"Tool Result: {content}")
            elif role == "system":
                formatted.append(f"System: {content}")
        
        return "\n\n".join(formatted)
    
    async def _execute_tool(self, tool_call: Dict[str, Any]) -> Any:
        """Execute a tool call"""
        tool_name = tool_call.get("tool")
        parameters = tool_call.get("parameters", {})
        
        if tool_name not in self.tools:
            return f"Error: Unknown tool '{tool_name}'"
        
        try:
            tool_func = self.tools[tool_name]["func"]
            
            # Execute tool (handle both sync and async functions)
            if asyncio.iscoroutinefunction(tool_func):
                result = await tool_func(**parameters)
            else:
                result = tool_func(**parameters)
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return f"Error executing tool: {str(e)}"
    
    # Default tool implementations
    
    def _web_search_tool(self, query: str) -> str:
        """Simulated web search tool"""
        # In production, integrate with a real search API
        return f"Search results for '{query}': [This is a simulated search result. In production, this would return real web search results.]"
    
    def _calculator_tool(self, expression: str) -> str:
        """Calculator tool for mathematical expressions"""
        try:
            # Use Python's eval safely for simple math
            import ast
            import operator as op
            
            # Supported operators
            operators = {
                ast.Add: op.add,
                ast.Sub: op.sub,
                ast.Mult: op.mul,
                ast.Div: op.truediv,
                ast.Pow: op.pow,
                ast.USub: op.neg
            }
            
            def eval_expr(expr):
                return eval(compile(ast.parse(expr, mode='eval'), '', 'eval'))
            
            result = eval_expr(expression)
            return f"Result: {result}"
            
        except Exception as e:
            return f"Error calculating: {str(e)}"
    
    def _time_tool(self) -> str:
        """Get current date and time"""
        now = datetime.now()
        return f"Current date and time: {now.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def _weather_tool(self, location: str) -> str:
        """Simulated weather tool"""
        # In production, integrate with a weather API
        return f"Weather in {location}: [This is simulated weather data. In production, this would return real weather information.]"
    
    def _read_file_tool(self, filename: str) -> str:
        """Read file contents"""
        try:
            with open(filename, 'r') as f:
                content = f.read()
            return f"File contents:\n{content[:1000]}..." if len(content) > 1000 else f"File contents:\n{content}"
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    def _write_file_tool(self, filename: str, content: str) -> str:
        """Write content to file"""
        try:
            with open(filename, 'w') as f:
                f.write(content)
            return f"Successfully wrote to {filename}"
        except Exception as e:
            return f"Error writing file: {str(e)}"
    
    def _system_info_tool(self) -> str:
        """Get system information"""
        import platform
        import psutil
        
        info = {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": f"{psutil.virtual_memory().total / (1024**3):.2f} GB",
            "memory_available": f"{psutil.virtual_memory().available / (1024**3):.2f} GB"
        }
        
        return json.dumps(info, indent=2)
    
    def get_execution_history(self) -> List[Dict[str, Any]]:
        """Get execution history"""
        return self.execution_history
    
    def clear_history(self):
        """Clear execution history"""
        self.execution_history.clear()