import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBstStore = defineStore('bst', () => {
    const values = ref([]) // Persistent array of node values

    function setValues(newValues) {
        values.value = newValues
    }

    function addValue(val) {
        if (!values.value.includes(val)) {
            values.value.push(val)
        }
    }

    function removeValue(val) {
        values.value = values.value.filter(v => v !== val)
    }

    function reset() {
        values.value = []
    }

    return { values, setValues, addValue, removeValue, reset }
})
