<template>
  <el-dialog
    v-model="visible"
    title="新建文档项目"
    width="500px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="项目名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="输入项目名称"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="项目描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          placeholder="输入项目描述（可选）"
          :rows="3"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          创建项目
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': [project: any]
}>()

const projectStore = useProjectStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const visible = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  visible.value = val
})

watch(visible, (val) => {
  emit('update:modelValue', val)
  if (!val) {
    formRef.value?.resetFields()
  }
})

const form = reactive({
  name: '',
  description: '',
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 50, message: '项目名称长度为 2-50 个字符', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    try {
      const project = await projectStore.createProject(form.name, form.description)
      ElMessage.success('项目创建成功')
      visible.value = false
      emit('created', project)
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error || '创建项目失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
:deep(.el-dialog) {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 16px;
}

:deep(.el-dialog__title) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}
</style>
