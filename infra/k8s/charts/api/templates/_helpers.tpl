{{- define "unified-api.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "unified-api.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{ .Values.fullnameOverride }}
{{- else -}}
{{ .Release.Name }}-{{ include "unified-api.name" . }}
{{- end -}}
{{- end -}}

{{- define "unified-api.labels" -}}
app.kubernetes.io/name: {{ include "unified-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "unified-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unified-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
