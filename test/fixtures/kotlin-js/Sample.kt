package sample

import react.ChildrenBuilder
import react.FC
import react.Key
import react.Props
import react.dom.html.ReactHTML.button
import react.dom.html.ReactHTML.div
import react.dom.html.ReactHTML.li
import react.dom.html.ReactHTML.span
import react.dom.html.ReactHTML.ul
import react.useCallback
import react.useEffect
import react.useMemo
import react.useRefValue
import react.useState

external interface TodoListProps : Props {
    var title: String
    var items: Array<String>
}

external interface Clock {
    fun now(): Double
}

/** A custom hook with a default argument and a memoized value. */
fun useVisibleItems(
    items: Array<String>,
    limit: Int = 3,
): List<String> =
    useMemo(items, limit) { items.take(limit) }

/** Reads a source React Compiler cannot track, so it opts out. */
fun useNow(clock: Clock): Double {
    js("\"use no memo\"")
    return clock.now()
}

/** Suspends, so an effect calling it runs as a coroutine. */
private suspend fun loadCount(): Int {
    kotlinx.coroutines.yield()
    return 1
}

/** A custom hook taking a suspend lambda. */
fun useAsyncEffect(
    key: Any?,
    block: suspend () -> Unit,
) {
    useEffect(key) { block() }
}

/** React does not own it, so an effect may write to it although a hook returned it. */
@com.github.porotkin.reactcompiler.Mutable
class Selection {
    var last: String = ""
}

private fun describe(item: String): String = "Item $item"

private fun ChildrenBuilder.Heading(title: String) {
    span { +title }
}

val TodoList: FC<TodoListProps> = FC { props ->
    val (expanded, setExpanded) = useState(false)
    val visible = useVisibleItems(props.items)
    val label = run { if (expanded) "Collapse" else "Expand" }
    val toggle = useCallback(expanded) { setExpanded(!expanded) }
    useEffect(expanded) { console.log(expanded) }
    var clicks by useState(0)
    var lastItem by useRefValue("")
    var loaded by useState(0)
    useEffect(props.title) { loaded = loadCount() }
    useAsyncEffect(expanded) { lastItem = visible.firstOrNull() ?: "" }
    val describeItem = useCallback(callback = ::describe)
    val selection = useMemo { Selection() }
    useEffect(clicks) { selection.last = label }

    Heading(props.title)
    div {
        button {
            onClick = {
                clicks += 1
                toggle()
            }
            +"$label $clicks $loaded"

        }
        if (expanded) {
            ul {
                for (item in visible) {
                    li {
                        key = Key(item)
                        +describeItem(item)
                    }
                }
            }
        }
    }
}

/** Keeps the declarations above in the production output. */
@Suppress("REACT_RULES_OF_HOOKS")
fun main() {
    console.log(TodoList, useNow(js("({ now: function () { return 0; } })")))
}
