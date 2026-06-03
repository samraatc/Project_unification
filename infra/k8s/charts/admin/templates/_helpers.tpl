{{- define "unified-admin.name" -}}{{ .Chart.Name }}{{- end -}}

{{- define "unified-admin.fullname" -}}
{{- if .Values.fullnameOverride -}}{{ .Values.fullnameOverride }}{{- else -}}{{ .Release.Name }}-{{ include "unified-admin.name" . }}{{- end -}}
{{- end -}}

{{- define "unified-admin.labels" -}}
app.kubernetes.io/name: {{ include "unified-admin.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "unified-admin.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unified-admin.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
