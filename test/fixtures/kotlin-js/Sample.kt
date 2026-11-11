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

private fun ChildrenBuilder.Heading(title: String) {
    span { +title }
}

val TodoList: FC<TodoListProps> = FC { props ->
    val (expanded, setExpanded) = useState(false)
    val visible = useVisibleItems(props.items)
    val label = run { if (expanded) "Collapse" else "Expand" }
    val toggle = useCallback(expanded) { setExpanded(!expanded) }
    useEffect(expanded) { console.log(expanded) }

    Heading(props.title)
    div {
        button {
            onClick = { toggle() }
            +label
        }
        if (expanded) {
            ul {
                for (item in visible) {
                    li {
                        key = Key(item)
                        +item
                    }
                }
            }
        }
    }
}

/** Keeps the declarations above in the production output. */
fun main() {
    console.log(TodoList, useNow(js("({ now: function () { return 0; } })")))
}
